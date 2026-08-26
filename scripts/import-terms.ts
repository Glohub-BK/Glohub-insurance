/**
 * 약관 파일 → 조항 저장.
 *
 *   npm run terms:import -- ./약관.pdf --insurer "DB손해보험" --product "내생애든든종합보험"
 *   npm run terms:import -- ./약관.txt --member 본인 --dry
 *
 * PDF 는 pdfjs 로 읽는다. 별도 설치가 필요 없다.
 * --dry 를 붙이면 DB 를 건드리지 않고 몇 조가 잡히는지만 보여준다 — 새 약관을 넣기
 * 전에 항상 이걸로 먼저 확인한다. 파서가 틀리면 인용문이 통째로 엉킨다.
 */
import './load-env';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { closePool, query, withTransaction } from '../src/lib/db';
import { parseClauses } from '../src/lib/terms/parse';
import { extractPdfText } from '../src/lib/terms/pdf';

type Args = {
  file: string;
  insurer?: string;
  product?: string;
  member: string;
  policyId?: string;
  dry: boolean;
};

function parseArgs(argv: string[]): Args {
  const [file, ...rest] = argv;
  if (!file) {
    // 인자 없이 부르는 일이 잦다. npm 은 `--` 를 붙여야 인자를 스크립트로 넘긴다.
    throw new Error(
      [
        '약관 파일 경로가 필요합니다.',
        '',
        '  npm run terms:import -- .\\약관.pdf --dry',
        '  npm run terms:import -- .\\약관.pdf --insurer "DB손해보험" --product "내생애든든종합보험"',
        '',
        'npm 은 `--` 뒤에 온 것만 스크립트로 넘깁니다. `--` 를 빼면 경로가 전달되지 않습니다.',
        '먼저 --dry 로 몇 조가 잡히는지 확인하세요.',
      ].join('\n'),
    );
  }
  const get = (name: string) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  return {
    file: resolve(file),
    insurer: get('insurer'),
    product: get('product'),
    member: get('member') ?? '본인',
    policyId: get('policy'),
    dry: rest.includes('--dry'),
  };
}

async function readText(file: string): Promise<string> {
  if (extname(file).toLowerCase() !== '.pdf') return readFileSync(file, 'utf8');
  const text = await extractPdfText(new Uint8Array(readFileSync(file)));
  if (text.trim().length === 0) {
    throw new Error(
      '텍스트를 하나도 뽑지 못했습니다. 스캔한 이미지 PDF 로 보입니다 — 보험사에서 텍스트 PDF 를 다시 받아주세요.',
    );
  }
  return text;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = await readText(args.file);
  const clauses = parseClauses(raw);

  console.log(`파일        ${basename(args.file)}`);
  console.log(`조항        ${clauses.length}개`);
  if (clauses.length === 0) {
    console.log('\n조항을 하나도 찾지 못했습니다. 스캔본이라 텍스트가 없거나, 조 번호 표기가 다를 수 있습니다.');
    return;
  }
  for (const c of clauses.slice(0, 3)) {
    console.log(`  ${c.articleLabel}${c.title ? `(${c.title})` : ''} — ${c.body.slice(0, 40)}…`);
  }

  if (args.dry) {
    console.log('\n--dry 라 저장하지 않았습니다.');
    return;
  }

  const hash = createHash('sha256').update(raw).digest('hex');
  const existing = await query<{ id: string }>(
    `select id from document where content_hash = $1`,
    [hash],
  );
  if (existing[0]) {
    console.log('\n같은 파일이 이미 들어 있습니다. 건너뜁니다.');
    return;
  }

  const members = await query<{ id: string }>(
    `select id from member where display_name = $1 order by created_at limit 1`,
    [args.member],
  );
  if (!members[0]) throw new Error(`구성원 '${args.member}' 를 찾지 못했습니다.`);

  const saved = await withTransaction(async (q) => {
    const [doc] = await q<{ id: string }>(
      `insert into document (member_id, policy_id, kind, title, storage_path, mime, bytes,
                             insurer_name, product_name, content_hash)
       values ($1, $2, '약관', $3, $4, $5, $6, $7, $8, $9)
       returning id`,
      [
        members[0].id,
        args.policyId ?? null,
        args.product ?? basename(args.file),
        args.file,
        extname(args.file).toLowerCase() === '.pdf' ? 'application/pdf' : 'text/plain',
        Buffer.byteLength(raw),
        args.insurer ?? null,
        args.product ?? null,
        hash,
      ],
    );

    for (const c of clauses) {
      await q(
        `insert into term_clause (document_id, ord, article_no, article_label, title, body)
         values ($1, $2, $3, $4, $5, $6)`,
        [doc.id, c.ord, c.articleNo, c.articleLabel, c.title, c.body],
      );
    }
    return doc.id;
  });

  console.log(`\n저장 완료   document ${saved} · 조항 ${clauses.length}개`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
