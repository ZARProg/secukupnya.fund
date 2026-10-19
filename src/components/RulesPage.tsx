import { useMemo, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Wand2 } from 'lucide-react';
import { useT } from '@/i18n';
import { useRules } from '@/hooks/useRules';
import { categoriesFor, findConflicts, MIN_KEYWORD_LENGTH, parseKeywords, ruleHits, type Rule, type RuleType } from '@/lib/rules';
import { getCategoryMeta } from '@/lib/categories';
import type { Transaction } from '@/lib/transactions';
import type { ToastState } from '@/components/Toast';

export function RulesPage({ transactions, onToast }: { transactions: Transaction[]; onToast: (t: ToastState) => void }) {
  const { t, tp } = useT();
  const { rules, addRule, updateRule, removeRule, moveRule } = useRules();
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const hits = useMemo(() => ruleHits(rules, transactions), [rules, transactions]);
  const conflicts = useMemo(() => findConflicts(rules), [rules]);

  return (
    <div className="space-y-5" data-testid="rules-page">
      <details className="rounded-2xl border border-line bg-card p-4 text-sm text-slate-700 shadow-card">
        <summary className="cursor-pointer font-semibold text-slate-900">{t('rules.how.title')}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t('rules.how.1')}</li>
          <li>{t('rules.how.2')}</li>
          <li>{t('rules.how.3')}</li>
          <li>{t('rules.how.4')}</li>
        </ul>
      </details>

      {editing ? (
        <RuleForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={(r) => {
            if (editing === 'new') {
              if (!addRule(r)) { onToast({ kind: 'error', message: t('rules.err.limit') }); return; }
            } else updateRule(editing.id, r);
            onToast({ kind: 'success', message: t('rules.toast.added') });
            setEditing(null);
          }}
        />
      ) : (
        <button onClick={() => setEditing('new')} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white" data-testid="rule-add-open">
          <Plus className="h-4 w-4" /> {t('rules.add')}
        </button>
      )}

      {rules.length === 0 && !editing ? (
        <p className="rounded-2xl border border-line bg-card p-6 text-sm text-slate-500" data-testid="rules-empty">{t('rules.empty')}</p>
      ) : (
        <ul className="space-y-2" data-testid="rules-list">
          {rules.map((r, i) => {
            const meta = getCategoryMeta(r.category, r.type);
            const Icon = meta.icon;
            const h = hits.get(r.id);
            const conflict = conflicts.get(r.id);
            return (
              <li key={r.id} className="rounded-2xl border border-line bg-card p-4 shadow-card" data-testid="rule-item">
                <div className="flex items-start gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}><Icon className={`h-4 w-4 ${meta.color}`} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      <span className="break-words">{r.keywords.join(', ')}</span>
                      <span className="mx-1.5 text-slate-500">→</span>
                      {r.category}
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">{t(r.type === 'income' ? 'rules.type.income' : 'rules.type.expense')}</span>
                    </p>
                    {h && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {tp('rules.hits', h.total)}{h.differs > 0 && <> · {t('rules.hits.differs', { n: h.differs })}</>}
                      </p>
                    )}
                    {conflict && <p className="mt-0.5 text-xs text-amber-700">{t('rules.conflict', { kw: conflict })}</p>}
                  </div>
                  <div className="flex shrink-0 items-center">
                    <IconBtn label={t('rules.up')} disabled={i === 0} onClick={() => moveRule(r.id, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn label={t('rules.down')} disabled={i === rules.length - 1} onClick={() => moveRule(r.id, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn label={t('rules.edit')} onClick={() => setEditing(r)}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn
                      label={t('rules.delete')}
                      danger
                      onClick={() => {
                        if (window.confirm(t('rules.deleteConfirm', { kw: r.keywords[0] }))) {
                          removeRule(r.id);
                          onToast({ kind: 'success', message: t('rules.toast.deleted') });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rules.length > 0 && <p className="flex items-start gap-2 text-xs text-slate-500"><Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('rules.existingNote')}</p>}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded-lg p-2 disabled:opacity-30 ${danger ? 'text-slate-500 hover:bg-red-50 hover:text-red-600' : 'text-slate-500 hover:bg-slate-100'}`}
    >
      {children}
    </button>
  );
}

function RuleForm({ initial, onSave, onCancel }: { initial: Rule | null; onSave: (r: Omit<Rule, 'id'>) => void; onCancel: () => void }) {
  const { t } = useT();
  const [kw, setKw] = useState(initial?.keywords.join(', ') ?? '');
  const [type, setType] = useState<RuleType>(initial?.type ?? 'expense');
  const [category, setCategory] = useState(initial?.category ?? categoriesFor(initial?.type ?? 'expense')[0]);
  const [error, setError] = useState('');
  const keywords = parseKeywords(kw);
  const short = keywords.some((k) => k.trim().length <= MIN_KEYWORD_LENGTH);

  function changeType(next: RuleType) {
    setType(next);
    if (!categoriesFor(next).includes(category)) setCategory(categoriesFor(next)[0]);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!keywords.length) { setError(t('rules.err.keywords')); return; }
    onSave({ keywords, category, type });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line bg-card p-5 shadow-card" data-testid="rule-form" aria-label={t(initial ? 'rules.edit' : 'rules.add')}>
      <h2 className="text-base font-bold text-slate-900">{t(initial ? 'rules.edit' : 'rules.add')}</h2>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-500">{t('rules.f.keywords')}</span>
        <input className="form-input" value={kw} onChange={(e) => { setKw(e.target.value); setError(''); }} placeholder={t('rules.f.keywords.placeholder')} data-testid="rule-keywords" />
        <span className="mt-1 block text-xs text-slate-500">{t('rules.f.keywords.hint')}</span>
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">{t('rules.f.type')}</span>
          <select className="form-input" value={type} onChange={(e) => changeType(e.target.value as RuleType)} data-testid="rule-type">
            <option value="expense">{t('rules.type.expense')}</option>
            <option value="income">{t('rules.type.income')}</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">{t('rules.f.category')}</span>
          <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="rule-category">
            {categoriesFor(type).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      {short && <p className="text-xs text-amber-700">{t('rules.err.short')}</p>}
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white" data-testid="rule-save">{t('rules.save')}</button>
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">{t('rules.cancel')}</button>
      </div>
    </form>
  );
}
