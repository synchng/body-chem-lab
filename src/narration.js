// Every sentence the narrator (준우) says is built here, so scripts/pregen-voice.js can save them all ahead of time
// with exactly the same wording the app uses (same text → same saved audio → no extra credits).
const NTH = ['첫 번째', '두 번째', '세 번째', '네 번째'];

// "Next" is the OK sign everywhere; the tutorial also explains how to make it.
export const tutorialLine = M =>
  `${M.kid ?? M.desc} 준비되면 OK 사인을 해 주세요. 엄지와 집게손가락을 동그랗게 붙이고, 나머지 손가락은 쭉 펴요.`;
export const conceptLine = d => [d.title, ...d.explain, '다 들었으면 OK 사인을 해 주세요.'].join(' ');
export const quizLine = ({ q, options }) =>
  `문제예요. ${q} ${options.map((o, i) => `${NTH[i]}, ${o}.`).join(' ')} 정답이라고 생각하는 답 위에 손을 올리고 잠깐 기다려요.`;
export const mistakeLine = hint => `틀렸어요. 하트가 하나 줄었어요. ${hint || '다시 해 보세요!'}`;
export const resultLine = hasNext =>
  `실험 완료! 잘했어요. ${hasNext ? '다음 실험으로 가려면' : '다른 실험을 고르려면'} OK 사인을 해 주세요. 다시 하고 싶으면 다시 하기 버튼 위에 손을 올려요.`;
export const LINES = {
  quizWrong: '틀렸어요. 다시 골라 보세요!',
  quizRight: '정답이에요! 잘했어요. 결과를 보려면 OK 사인을 해 주세요.',
  outOfHearts: '하트를 모두 잃었어요. 괜찮아요, 다시 도전하려면 OK 사인을 해 주세요!',
};
