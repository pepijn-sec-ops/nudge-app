import { useEffect, useState } from 'react';
import { api, type Note } from '../lib/api';

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');

  async function loadNotes() {
    try {
      const data = await api<{ notes: Note[] }>('/api/notes');
      setNotes(data.notes);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadNotes();
  }, []);

  async function createNote() {
    const content = text.trim();
    if (!content) return;
    try {
      await api('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ content, context: 'general' }),
      });
      setText('');
      await loadNotes();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-6 shadow-xl backdrop-blur-md">
        <h1 className="text-2xl font-extrabold text-[color:var(--nudge-text)]">Idea notes</h1>
        <p className="mt-1 text-sm opacity-75">Capture thoughts during focus/work and pin important ones to Home.</p>
        <div className="mt-4 flex gap-2">
          <input
            className="flex-1 rounded-2xl border border-black/10 bg-white/80 px-4 py-3 font-semibold"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a thought..."
          />
          <button
            type="button"
            onClick={() => void createNote()}
            className="rounded-[2rem] bg-[color:var(--nudge-primary)] px-5 py-3 font-extrabold text-white shadow"
          >
            Add
          </button>
        </div>
      </section>

      <section className="space-y-3">
        {notes.map((n) => (
          <div
            key={n.id}
            className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-4 shadow-md backdrop-blur-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[color:var(--nudge-text)] font-semibold">{n.content}</p>
                <p className="mt-1 text-xs opacity-65 capitalize">{n.context}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-bold ${n.pinned ? 'bg-[color:var(--nudge-primary)] text-white' : 'bg-white/70'}`}
                  onClick={async () => {
                    await api(`/api/notes/${n.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ pinned: !n.pinned }),
                    });
                    await loadNotes();
                  }}
                >
                  {n.pinned ? 'Pinned' : 'Pin'}
                </button>
                <button
                  type="button"
                  className="rounded-full px-3 py-1 text-xs font-bold bg-rose-100 text-rose-700"
                  onClick={async () => {
                    await api(`/api/notes/${n.id}`, { method: 'DELETE' });
                    await loadNotes();
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {notes.length === 0 && <p className="text-sm opacity-70">No notes yet.</p>}
      </section>
    </div>
  );
}
