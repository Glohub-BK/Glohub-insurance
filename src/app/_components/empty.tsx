import { Card } from './ui';

export function EmptyHousehold() {
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-[18px] font-bold">아직 데이터가 없습니다</h2>
      <p className="text-[15px]" style={{ color: 'var(--ink-2)' }}>
        터미널에서 아래를 실행하면 예시 데이터로 화면을 확인할 수 있습니다.
      </p>
      <pre
        className="tnum overflow-x-auto rounded-[10px] p-3 text-[14px]"
        style={{ background: 'var(--sub)', color: 'var(--ink-2)' }}
      >
        npm run db:migrate{'\n'}npm run db:seed
      </pre>
    </Card>
  );
}
