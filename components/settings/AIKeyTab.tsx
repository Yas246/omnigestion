'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { callDeepSeek, getDeepSeekKey, setDeepSeekKey } from '@/lib/ai/deepseek';

/**
 * DeepSeek API key management — the key lives ONLY in the browser's localStorage
 * and AI calls go browser → DeepSeek directly. It never reaches the Omnigestion
 * backend, which the disclaimer makes explicit.
 */
export function AIKeyTab() {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | { ok: boolean; msg: string }>(null);

  useEffect(() => {
    setKey(getDeepSeekKey() ?? '');
    setSaved(!!getDeepSeekKey());
  }, []);

  const handleSave = () => {
    setDeepSeekKey(key);
    setSaved(!!key.trim());
    setTestResult(null);
    toast.success(key.trim() ? 'Clé DeepSeek enregistrée' : 'Clé DeepSeek supprimée');
  };

  const handleTest = async () => {
    setDeepSeekKey(key); // save before testing
    setSaved(!!key.trim());
    if (!key.trim()) {
      setTestResult({ ok: false, msg: 'Saisissez une clé avant de tester.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await callDeepSeek({
        messages: [{ role: 'user', content: 'Réponds uniquement par le mot : OK' }],
        effort: 'high',
      });
      setTestResult({ ok: true, msg: `Connexion OK — DeepSeek a répondu : « ${(r.content || 'OK').trim().slice(0, 40)} ».` });
    } catch (e: any) {
      setTestResult({ ok: false, msg: e?.message ?? 'Échec du test.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Intelligence artificielle (DeepSeek)
          </CardTitle>
          <CardDescription>
            Clé utilisée par les fonctionnalités IA (Analyse IA). Reste dans votre navigateur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deepseek-key">Clé API DeepSeek</Label>
            <Input
              id="deepseek-key"
              type="password"
              autoComplete="off"
              placeholder="sk-..."
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setSaved(false);
                setTestResult(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Créez une clé sur{' '}
              <a
                href="https://platform.deepseek.com/api_keys"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                platform.deepseek.com
              </a>
              . Modèle utilisé : <code className="rounded bg-muted px-1">deepseek-v4-flash</code> (thinking activé).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} variant="outline">
              {saved ? 'Mettre à jour' : 'Enregistrer'}
            </Button>
            <Button onClick={handleTest} variant="secondary" disabled={testing || !key.trim()}>
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Tester la connexion
            </Button>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                testResult.ok
                  ? 'border-[oklch(0.65_0.12_145)]/30 bg-[oklch(0.65_0.12_145)]/10 text-foreground'
                  : 'border-destructive/30 bg-destructive/10 text-destructive'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.42_0.11_145)]" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{testResult.msg}</span>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Votre clé API est stockée <strong>uniquement dans ce navigateur</strong> (localStorage) et
              les requêtes IA partent directement vers DeepSeek. Elle n&apos;est <strong>jamais envoyée vers nos serveurs</strong>.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
