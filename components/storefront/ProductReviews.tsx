'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_ORIGIN } from '@/lib/api/client';
import { useBuyer } from '@/lib/storefront/buyer-context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Review {
  id: number;
  rating: number;
  comment: string | null;
  author: string;
  createdAt: string;
}

export function ProductReviews({ slug, productId, disp }: { slug: string; productId: number; disp: React.CSSProperties }) {
  const { buyer, authHeader } = useBuyer();
  const [avg, setAvg] = useState(0);
  const [count, setCount] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/public/store/${slug}/product/${productId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setAvg(data.avg ?? 0);
        setCount(data.count ?? 0);
        setReviews(data.reviews ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [slug, productId]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleSubmit = async () => {
    if (!userRating) { toast.error('Sélectionnez une note'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/public/store/${slug}/product/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ rating: userRating, comment: comment || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erreur');
      }
      toast.success('Merci pour votre avis !');
      setUserRating(0);
      setComment('');
      fetchReviews();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-20 border-t pt-12" style={{ borderColor: 'color-mix(in srgb, var(--store-text) 10%, transparent)' }}>
      <h2 className="mb-6 text-2xl tracking-tight" style={disp}>Avis clients</h2>

      {/* Summary */}
      {count > 0 && (
        <div className="mb-8 flex items-center gap-4">
          <span className="text-4xl font-bold" style={disp}>{avg.toFixed(1)}</span>
          <div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`h-4 w-4 ${s <= Math.round(avg) ? 'fill-current' : ''}`} style={{ color: 'var(--store-accent)' }} />
              ))}
            </div>
            <p className="text-sm opacity-60">{count} avis</p>
          </div>
        </div>
      )}

      {/* Review list */}
      {loading ? (
        <div className="py-8 text-center opacity-50"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      ) : reviews.length === 0 ? (
        <div className="rounded-sm border p-8 text-center opacity-60" style={{ borderColor: 'color-mix(in srgb, var(--store-text) 10%, transparent)' }}>
          <p className="text-sm">Soyez le premier à laisser un avis sur ce produit.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((r) => (
            <div key={r.id} className="border-b pb-6" style={{ borderColor: 'color-mix(in srgb, var(--store-text) 8%, transparent)' }}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-medium" style={disp}>{r.author}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`h-3 w-3 ${s <= r.rating ? 'fill-current' : ''}`} style={{ color: 'var(--store-accent)' }} />
                    ))}
                  </div>
                </div>
                <span className="text-xs opacity-40">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</span>
              </div>
              {r.comment && <p className="text-sm leading-relaxed opacity-80">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Add review form */}
      {buyer ? (
        <div className="mt-8 rounded-sm border p-6" style={{ borderColor: 'color-mix(in srgb, var(--store-text) 10%, transparent)' }}>
          <h3 className="mb-4 text-lg" style={disp}>Laisser un avis</h3>
          <div className="mb-4 flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} type="button" onClick={() => setUserRating(s)} onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)}>
                <Star className={`h-7 w-7 transition-colors ${(hoverRating || userRating) >= s ? 'fill-current' : ''}`} style={{ color: (hoverRating || userRating) >= s ? 'var(--store-accent)' : 'color-mix(in srgb, var(--store-text) 20%, transparent)' }} />
              </button>
            ))}
          </div>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Partagez votre expérience..." className="mb-3 resize-none" rows={3} />
          <Button onClick={handleSubmit} disabled={submitting || !userRating}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Publier mon avis
          </Button>
        </div>
      ) : (
        <p className="mt-6 text-center text-sm opacity-50">Connectez-vous pour laisser un avis.</p>
      )}
    </section>
  );
}
