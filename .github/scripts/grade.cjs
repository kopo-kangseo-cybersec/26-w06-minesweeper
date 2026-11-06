const fs = require('fs');

async function callGemini(model, apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048
    }
  };

  console.log(`[Gemini] ${model} 모델 채점 생성 요청 시작 (타임아웃 30초)...`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Gemini] ${model} HTTP Error ${res.status}:`, errText);
      return null;
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content || !candidate.content.parts) {
      console.error('[Gemini] 응답에 후보가 없음:', JSON.stringify(data));
      return null;
    }

    const reply = candidate.content.parts
      .map(p => p.text || '')
      .filter(Boolean)
      .join('\n')
      .trim();

    return reply;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`[Gemini] ${model} 요청 중 오류:`, err.message);
    return null;
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('::warning::GEMINI_API_KEY가 등록되지 않았습니다. 기본 접수 코멘트만 등록합니다.');
    fs.writeFileSync('result_comment.txt', '### ✅ 과제 제출 접수 완료\n과제가 정상적으로 접수되었습니다. (자동 채점 API 키 설정 대기 중)');
    fs.writeFileSync('summary.txt', '기본 접수 완료 (Gemini API 키 미설정)');
    fs.writeFileSync('status.txt', 'PASS');
    return;
  }

  const prBody = fs.existsSync('pr_body.txt') ? fs.readFileSync('pr_body.txt', 'utf8') : '';
  const prFiles = fs.existsSync('pr_files.txt') ? fs.readFileSync('pr_files.txt', 'utf8') : '';
  const prDiff = fs.existsSync('pr_diff.txt') ? fs.readFileSync('pr_diff.txt', 'utf8') : '';
  const author = process.env.PR_AUTHOR || '학생';

  const systemPrompt = `당신은 한국폴리텍대학 강서캠퍼스 사이버보안과 1학년 「웹콘텐츠 제작」 수업의 AI 채점 조교입니다.
학생이 제출한 PR 본문, 변경 파일 목록, 주요 diff를 검토하여 정중하고 친절한 어조(존댓말)로 전문적인 채점 피드백을 작성해 주세요.

## 6~7주차 지뢰찾기 게임 (PRD 기반 Agent 구현 & freeform 비교) 채점 기준표
1. [브랜치 및 PRD (규칙 준수)]
   - prd 또는 dev 브랜치 기준 PR이며, PRD.md 파일이 작성되어 있는지 확인.
2. [비교 분석 (freeform vs prd)]
   - PR 본문이나 README에 자유 생성(freeform) 방식과 PRD 기반(prd) 방식을 비교한 소감(규칙 명세의 효과, 버그 감소, 구현 통제력 등)이 성의 있게 작성되었는지 확인.
   - 비교 내용이 비어있거나 주석만 남아있으면 ⚠️ 보완으로 판정하세요.
3. [배포 완성도 (GitHub Pages)]
   - PR 본문에 실제 작동하는 GitHub Pages 배포 링크(예: https://<username>.github.io/...)가 적혀 있는지 확인.
   - 중요: 배포 URL이 비어 있거나, 로컬 주소(127.0.0.1, localhost)이거나, .git 저장소 주소인 경우 "배포" 항목은 반드시 ⚠️ 확인/보완으로 판정하세요.
4. [게임 구현 및 커스터마이징]
   - 지뢰찾기 핵심 게임 로직(지뢰 생성, 숫자 계산, 연쇄 오픈, 깃발 등)과 커스터마이징(난이도, UI, 타이머 등)이 반영되었는지 확인.

## 출력 형식 (Markdown)
### 📋 6~7주차 과제 채점 리포트 (${author} 학생)

| 평가 항목 | 결과 | 코멘트 |
|---|:---:|---|
| 🌿 브랜치 및 PRD (규칙 준수) | ✅ PASS / ⚠️ 보완 | 내용 요약 |
| 🔍 접근법 비교 (freeform vs prd) | ✅ PASS / ⚠️ 보완 | 비교 소감 및 성찰 평가 |
| 🚀 배포 (GitHub Pages) | ✅ PASS / ⚠️ 확인 | 배포 URL 정상 여부 |
| 🎮 게임 구현 및 커스터마이징 | ✅ PASS / 💬 조언 | 게임 로직 및 커스텀 요소 평가 |

#### 💡 총평 및 피드백
- 학생의 구현 노력을 칭찬하고 개선 포인트를 친절하게 짚어주세요.

#### 🎯 종합 판정: [통과 (PASS)] 또는 [보완 필요]
※ 배포 URL이 유효하지 않거나, freeform vs prd 비교 소감이 누락된 경우 종합 판정을 반드시 [보완 필요]로 작성해 주세요.
`;

  const fullPrompt = `${systemPrompt}\n\n## [학생이 제출한 PR 본문]\n${prBody}\n\n## [변경된 파일 목록]\n${prFiles}\n\n## [주요 코드 Diff]\n${prDiff}`;

  const models = ['gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
  let reply = null;

  for (const m of models) {
    reply = await callGemini(m, apiKey, fullPrompt);
    if (reply) {
      console.log(`[Gemini] ${m} 모델 채점 성공!`);
      break;
    }
  }

  if (reply) {
    fs.writeFileSync('result_comment.txt', reply);
    
    // 종합 판정 라인 파싱
    const verdictLine = (reply.split('\n').find(l => l.includes('종합 판정')) || '').trim();
    const isRetry = verdictLine.includes('보완 필요') || verdictLine.includes('RETRY');
    const isPass = !isRetry && (verdictLine.includes('통과') || verdictLine.includes('PASS'));
    
    const status = isPass ? 'PASS' : 'RETRY';
    fs.writeFileSync('status.txt', status);
    fs.writeFileSync('summary.txt', isPass ? '통과 (PASS)' : '보완 필요');
    console.log(`[Gemini] 채점 판정 완료: ${status} ("${verdictLine}")`);
  } else {
    fs.writeFileSync('result_comment.txt', '### ⚠️ 과제 제출 접수 완료\n과제는 정상 접수되었으나 일시적인 AI 서비스 응답 지연으로 자동 채점 리포트 생성이 지연되었습니다. 교수가 직접 검토할 예정입니다.');
    fs.writeFileSync('summary.txt', '접수 완료 (AI 응답 지연)');
    fs.writeFileSync('status.txt', 'RETRY');
  }
}

main();
