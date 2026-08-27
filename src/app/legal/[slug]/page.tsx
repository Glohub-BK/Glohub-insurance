import { notFound } from 'next/navigation';
import { LEGAL_DOCS, findDoc } from '@/lib/legal/documents';
import { LegalBody } from '../../_components/legal';

/** 문서는 정적이다. 미리 만들어 둔다. */
export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata(props: PageProps<'/legal/[slug]'>) {
  const { slug } = await props.params;
  const doc = findDoc(slug);
  return { title: doc?.title ?? '약관 및 정책' };
}

export default async function LegalDocPage(props: PageProps<'/legal/[slug]'>) {
  const { slug } = await props.params;
  const doc = findDoc(slug);
  if (!doc) notFound();
  return <LegalBody doc={doc} />;
}
