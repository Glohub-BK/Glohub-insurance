/**
 * CLI 스크립트용 환경변수 로더.
 * Next.js 와 같은 우선순위를 쓴다: .env.local 이 .env 를 덮어쓴다.
 */
import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.local', override: true });
