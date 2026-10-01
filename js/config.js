// Exam timing and format.
//
// 12 blocks x 30 items, 33 minutes per block: confirmed by the user (ICVA format from the
// Oct-Nov 2026 testing window).
export const EXAM_CONFIG = {
  timingVerified: true,
  questionsPerBlock: 30,
  secondsPerBlock: 33 * 60,
  fullExamBlocks: 12,
  breakBankSeconds: 50 * 60, // ICVA Candidate Handbook 2026-27: 50 minutes total, between blocks only
  practiceBlockOptions: [1, 2],
  optionsPerItem: 5,
};
