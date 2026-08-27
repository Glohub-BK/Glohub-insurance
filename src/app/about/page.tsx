import Link from 'next/link';
import { COMPANY } from '@/lib/legal/company';
import { Card, Icon, ICONS } from '../_components/ui';
import { BusinessInfo } from '../_components/legal';
import { Beoni, LogoHorizontal } from '../_components/brand';

export const metadata = { title: '회사 소개' };

export default function AboutPage() {
  return (
    <>
      <Card className="flex flex-col items-center gap-3 py-6">
        <LogoHorizontal height={54} />
        <p className="text-center text-[16px] font-semibold" style={{ color: 'var(--brand-ink)' }}>
          우리 가족 보험, 놓치지 않게
        </p>
      </Card>

      <Card className="flex flex-col gap-2.5">
        <h2 className="text-[16px] font-bold">왜 만들었나</h2>
        <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          보험은 이미 들어 두었는데, 정작 사고가 났을 때 <b className="font-semibold">내가 뭘 청구할 수
          있는지 몰라서</b> 그냥 지나가는 일이 많습니다. 보험금 청구권은 3년이 지나면 사라집니다.
        </p>
        <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          놓칠뻔은 새 보험을 팔지 않습니다. <b className="font-semibold">이미 가진 걸 못 쓰고 넘어가지
          않게</b> 하는 것이 전부입니다.
        </p>
      </Card>

      <Card className="flex items-start gap-3" tone="brand">
        <Beoni pose="found" height={44} />
        <span className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          답할 때는 <b className="font-semibold">약관 조항을 원문 그대로 인용</b>하고 어느 문서 몇 조인지
          함께 적습니다. 근거를 찾지 못하면 답하지 않습니다.
        </span>
      </Card>

      <Card className="flex flex-col gap-2.5">
        <h2 className="text-[16px] font-bold">지키는 선</h2>
        <ul className="flex flex-col gap-2">
          {[
            '보험금을 얼마 받을지 계산하지 않습니다 — 약관에 적힌 한도만 보여줍니다.',
            '청구를 대신 접수하거나 보험회사와 협상하지 않습니다.',
            '지급액에 연동한 수수료를 받지 않습니다.',
            '보험상품을 권유하거나 설계사를 연결하지 않습니다.',
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-[15px] leading-relaxed">
              <span className="mt-0.5 flex-none" style={{ color: 'var(--brand-ink)' }}>
                <Icon path={ICONS.check} size={18} />
              </span>
              <span style={{ color: 'var(--ink-2)' }}>{t}</span>
            </li>
          ))}
        </ul>
        <p className="note mt-1">
          보험업법 제185조~제189조(손해사정업)의 경계입니다. 자세한 내용은{' '}
          <Link href="/legal/notice" style={{ color: 'var(--brand-ink)' }}>
            알아두실 사항
          </Link>
          에 있습니다.
        </p>
      </Card>

      <Card className="flex flex-col gap-2.5">
        <h2 className="text-[16px] font-bold">만드는 곳</h2>
        <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          {COMPANY.operator}는 공공데이터를 사람이 읽을 수 있는 형태로 옮기는 일을 합니다.
          국내 체류 외국인을 위한 생활정보 플랫폼{' '}
          <a href={COMPANY.site} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-ink)' }}>
            Glohub
          </a>
          을 운영하고 있습니다.
        </p>
      </Card>

      <BusinessInfo />
    </>
  );
}
