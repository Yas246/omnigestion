'use client';

import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

/**
 * Camera QR scanner (html5-qrcode). Mounts the camera into a div with the given
 * id, decodes the first QR it sees, then calls onScan(text) and stops. Requires
 * HTTPS or localhost (camera permission) — the CSP now allows camera=(self).
 */
export default function QrScanner({
  active,
  onScan,
  onError,
}: {
  active: boolean;
  onScan: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const elementId = 'qr-scanner-region';
  // Keep the latest callbacks without re-triggering the start effect.
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
  }, [onScan, onError]);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const scanner = new Html5Qrcode(elementId, { verbose: false });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        (decodedText) => {
          if (stopped) return;
          stopped = true;
          onScanRef.current(decodedText);
          scanner.stop().catch(() => {});
        },
        () => {}
      )
      .catch((err) => {
        onErrorRef.current?.(
          err?.message?.includes('Permission')
            ? 'Autorisation caméra refusée.'
            : 'Caméra indisponible (requires HTTPS/localhost).'
        );
      });

    return () => {
      stopped = true;
      if (scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, [active]);

  if (!active) return null;
  // Fixed square size from the moment the dialog opens, so the modal layout is
  // stable before the camera stream loads its first frame (previously the box
  // only reached its correct size once a QR was detected).
  return (
    <div className="flex justify-center">
      <div
        id={elementId}
        className="overflow-hidden rounded-lg bg-black"
        style={{ width: '100%', maxWidth: 340, aspectRatio: '1 / 1' }}
      />
    </div>
  );
}
