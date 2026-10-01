// Question bank access. Today it loads static JSON; later this can call an API
// (and keep answers server-side) without changing the UI.
export class StaticBank {
  constructor(base = 'data') { this.base = base; }

  async loadBlueprint() {
    const r = await fetch(`${this.base}/blueprint.json`);
    if (!r.ok) throw new Error('Could not load blueprint.json');
    return r.json();
  }

  async loadQuestions() {
    const idx = await (await fetch(`${this.base}/questions/index.json`)).json();
    const files = await Promise.all(idx.files.map((f) => fetch(`${this.base}/questions/${f}`).then((r) => r.json())));
    return files.flat();
  }
}
