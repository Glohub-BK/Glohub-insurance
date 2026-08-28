'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 약관 올리기 버튼.
 *
 * 휴대폰에서 「파일 앱 / 다운로드 폴더」를 열어 방금 공시실에서 받은 PDF 를 고르게 한다.
 * 업로드는 서버 액션이 아니라 라우트 핸들러로 보낸다 — 서버 액션 본문은 1MB 에서 잘리고
 * 약관은 그보다 크다.
 */
export function UploadTerms({
  policyId,
  label = '약관 올리기',
}: {
  policyId?: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  // Vercel 서버리스는 요청 본문을 4.5MB 로 자른다. 그보다 큰 파일(KB 약관이 그랬다)은
  // 3MB 조각으로 나눠 보내고 서버가 이어붙인다. 작은 파일은 지금처럼 한 번에 간다.
  const SINGLE_LIMIT = 4 * 1024 * 1024;
  const CHUNK = 3 * 1024 * 1024;

  async function send(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      let res: Response;
      if (file.size > SINGLE_LIMIT) {
        const uploadId = crypto.randomUUID();
        const chunkCount = Math.ceil(file.size / CHUNK);
        for (let i = 0; i < chunkCount; i += 1) {
          setMsg({ tone: 'ok', text: `올리는 중 ${i + 1}/${chunkCount}…` });
          const piece = file.slice(i * CHUNK, (i + 1) * CHUNK);
          const r = await fetch(`/api/terms/upload-chunk?uploadId=${uploadId}&seq=${i}`, {
            method: 'POST',
            headers: { 'content-type': 'application/octet-stream' },
            body: piece,
          });
          if (!r.ok) throw new Error(`chunk ${i} 실패 (${r.status})`);
        }
        setMsg({ tone: 'ok', text: '조각을 이어붙여 읽는 중…' });
        res = await fetch('/api/terms/upload', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ uploadId, chunkCount, fileName: file.name, policyId }),
        });
      } else {
        const form = new FormData();
        form.set('file', file);
        if (policyId) form.set('policyId', policyId);
        res = await fetch('/api/terms/upload', { method: 'POST', body: form });
      }
      const data = (await res.json()) as
        | { ok: true; clauseCount: number; duplicate: boolean; warning?: string }
        | { ok: false; message: string };

      if (!data.ok) {
        setMsg({ tone: 'bad', text: data.message });
        return;
      }
      const base = data.duplicate
        ? `이미 들어 있는 약관이에요 — 조항을 다시 읽어 ${data.clauseCount.toLocaleString('ko-KR')}개로 맞췄어요.`
        : `조항 ${data.clauseCount.toLocaleString('ko-KR')}개를 읽었어요.`;
      setMsg({ tone: 'ok', text: data.warning ? `${base} ⚠ ${data.warning}` : base });
      start(() => router.refresh());
    } catch (error) {
      console.error('[terms] 업로드 실패', error);
      setMsg({ tone: 'bad', text: '올리지 못했어요. 연결을 확인하고 다시 시도해주세요.' });
    } finally {
      setBusy(false);
    }
  }

  const working = busy || pending;

  return (
    <span className="flex flex-col items-stretch gap-1.5">
      <button
        type="button"
        disabled={working}
        onClick={() => inputRef.current?.click()}
        className="rounded-[11px] px-3 py-2 text-[14px] font-semibold"
        style={{
          background: 'var(--brand-soft)',
          border: '1px solid var(--brand-line)',
          color: 'var(--brand-ink)',
          opacity: working ? 0.6 : 1,
        }}
      >
        {working ? '읽는 중…' : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void send(f);
        }}
      />
      {msg ? (
        <span
          role="status"
          className="text-[13px] leading-snug"
          style={{ color: msg.tone === 'ok' ? 'var(--brand-ink)' : 'var(--alert)' }}
        >
          {msg.text}
        </span>
      ) : null}
    </span>
  );
}

/**
 * 공시실 열기 + 상품명 복사.
 *
 * 공시실 검색창에 상품명을 손으로 옮겨 적는 게 제일 귀찮은 단계다. 눌러서 복사해 두고
 * 새 탭을 열어주면 붙여넣기 한 번이면 된다.
 */
export function OpenDisclosure({
  url,
  term,
  hint,
}: {
  url: string;
  term: string;
  hint: string;
}) {
  const [copied, setCopied] = useState(false);

  async function go() {
    if (term) {
      try {
        await navigator.clipboard.writeText(term);
        setCopied(true);
      } catch {
        // 클립보드를 못 쓰는 브라우저도 있다. 복사에 실패해도 공시실은 열어준다.
        setCopied(false);
      }
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <span className="flex flex-col items-stretch gap-1.5">
      <button
        type="button"
        onClick={() => void go()}
        className="rounded-[11px] px-3 py-2 text-[14px] font-bold text-white"
        style={{ background: 'var(--brand-grad)', boxShadow: 'var(--e1)' }}
      >
        공시실에서 원본 받기
      </button>
      <span className="text-[13px] leading-snug" style={{ color: 'var(--ink-3)' }}>
        {copied ? `「${term}」 복사됨 — 검색창에 붙여넣기` : hint}
      </span>
    </span>
  );
}
