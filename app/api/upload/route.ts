import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configuration de Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    // Validation du type de fichier
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Le fichier doit être une image' }, { status: 400 });
    }

    // Validation de la taille (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'L\'image ne doit pas dépasser 2 Mo' }, { status: 400 });
    }

    // Convertir le File en buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload vers Cloudinary
    return new Promise<NextResponse>((resolve) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: 'omnigestion/logos',
          transformation: [
            { width: 500, height: 500, crop: 'limit' }, // Limiter à 500x500
            { quality: 'auto' }, // Optimiser la qualité
            { fetch_format: 'auto' }, // Format optimal
          ],
        },
        (error, result) => {
          if (error) {
            console.error('Erreur Cloudinary:', error);
            resolve(NextResponse.json({ error: 'Erreur lors de l\'upload' }, { status: 500 }));
          } else {
            resolve(NextResponse.json({
              url: result?.secure_url,
              publicId: result?.public_id,
            }));
          }
        }
      ).end(buffer);
    });
  } catch (error) {
    console.error('Erreur upload:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE pour supprimer une image
export async function DELETE(request: NextRequest) {
  try {
    const { publicId } = await request.json();

    if (!publicId) {
      return NextResponse.json({ error: 'publicId requis' }, { status: 400 });
    }

    await cloudinary.uploader.destroy(publicId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression:', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
  }
}
