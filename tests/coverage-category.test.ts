import { describe, expect, it } from 'vitest';
import {
  classifyCoverage,
  needsReview,
  CATEGORY_LABELS,
  COVERAGE_CATEGORIES,
} from '@/lib/domain/coverage-category';

describe('classifyCoverage — 정상 케이스', () => {
  const cases: Array<[string, string]> = [
    ['상해입원의료비', 'actual_loss'],
    ['질병통원의료비(외래)', 'actual_loss'],
    ['실손의료비 상해의료', 'actual_loss'],
    ['가족일상생활중배상책임', 'liability'],
    ['자녀배상책임특약', 'liability'],
    ['임차자배상책임', 'liability'],
    ['암진단비', 'diagnosis'],
    ['뇌졸중진단비', 'diagnosis'],
    ['급성심근경색증진단비', 'diagnosis'],
    ['질병수술비', 'surgery'],
    ['상해입원일당', 'hospital'],
    ['재해장해(80%이상)', 'disability'],
    ['일반상해사망', 'death'],
    ['주택화재손해', 'fire'],
    ['가재도구손해', 'fire'],
    ['교통사고처리지원금', 'driver'],
    ['변호사선임비용', 'driver'],
    ['중증치매간병비', 'care'],
    ['노후연금적립액', 'savings'],
  ];

  it.each(cases)('%s → %s', (name, expected) => {
    expect(classifyCoverage(name).category).toBe(expected);
  });
});

describe('classifyCoverage — 우선순위', () => {
  it('의료비가 붙으면 입원이 아니라 실손으로 간다', () => {
    expect(classifyCoverage('상해입원의료비').category).toBe('actual_loss');
    expect(classifyCoverage('상해입원일당').category).toBe('hospital');
  });

  it('자동차손해배상은 배상책임이 아니라 운전자로 간다', () => {
    expect(classifyCoverage('자동차손해배상책임').category).toBe('driver');
  });

  it('진단이 수술보다 먼저 걸린다', () => {
    expect(classifyCoverage('암진단후수술비').category).toBe('diagnosis');
  });
});

describe('classifyCoverage — 경계 및 오류 케이스', () => {
  it('빈 문자열은 other, 신뢰도 0', () => {
    const r = classifyCoverage('');
    expect(r.category).toBe('other');
    expect(r.confidence).toBe(0);
    expect(needsReview(r)).toBe(true);
  });

  it('공백만 있어도 other', () => {
    expect(classifyCoverage('   ').category).toBe('other');
  });

  it('null/undefined 가 들어와도 던지지 않는다', () => {
    expect(classifyCoverage(undefined as unknown as string).category).toBe('other');
    expect(classifyCoverage(null as unknown as string).category).toBe('other');
  });

  it('알 수 없는 담보명은 other 이고 검수 대상이다', () => {
    const r = classifyCoverage('알수없는특약가나다');
    expect(r.category).toBe('other');
    expect(needsReview(r)).toBe(true);
  });

  it('공백과 괄호가 섞여도 같은 결과가 나온다', () => {
    expect(classifyCoverage('가족 일상생활 중 배상책임').category).toBe('liability');
    expect(classifyCoverage('가족일상생활중배상책임').category).toBe('liability');
    expect(classifyCoverage('[특약] 가족·일상생활중 배상책임').category).toBe('liability');
  });

  it('매칭된 키워드를 남겨 검수할 수 있게 한다', () => {
    expect(classifyCoverage('암진단비').matchedKeyword).toBe('암진단');
  });
});

describe('카테고리 정의 일관성', () => {
  it('모든 카테고리에 라벨이 있다', () => {
    for (const c of COVERAGE_CATEGORIES) {
      expect(CATEGORY_LABELS[c]).toBeTruthy();
    }
  });
});
