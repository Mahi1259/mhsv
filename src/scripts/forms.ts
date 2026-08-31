interface FormStrings {
  errors: Record<string, string>;
  successTitle: string;
  successBody: string;
  errorTitle: string;
  errorBody: string;
}

function setup(form: HTMLFormElement) {
  const stringsEl = document.querySelector<HTMLScriptElement>(
    `[data-form-strings="${form.id}"]`,
  );
  if (!stringsEl?.textContent) return;
  const strings: FormStrings = JSON.parse(stringsEl.textContent);

  const stamp = form.elements.namedItem('rendered_at') as HTMLInputElement | null;
  if (stamp) stamp.value = String(Date.now());

  const result = form.querySelector<HTMLElement>('[data-result]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!result || !button) return;

  const clearErrors = () => {
    form.querySelectorAll<HTMLElement>('[data-error-for]').forEach((el) => {
      el.textContent = '';
      const field = form.elements.namedItem(el.dataset.errorFor!) as HTMLElement | null;
      field?.removeAttribute('aria-invalid');
    });
  };

  const showErrors = (names: string[]) => {
    let first: HTMLElement | null = null;
    for (const name of names) {
      const el = form.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
      const field = form.elements.namedItem(name) as HTMLElement | null;
      if (el) el.textContent = strings.errors[name] ?? '';
      if (field) {
        field.setAttribute('aria-invalid', 'true');
        if (!first) first = field;
      }
    }
    first?.focus();
  };

  const showResult = (kind: 'success' | 'error', title: string, body: string) => {
    result.hidden = false;
    result.dataset.kind = kind;
    result.querySelector<HTMLElement>('[data-result-title]')!.textContent = title;
    result.querySelector<HTMLElement>('[data-result-body]')!.textContent = body;
  };

  const validate = (data: FormData): string[] => {
    const invalid: string[] = [];
    for (const field of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      '[required]',
    )) {
      const name = field.name;
      if (!name) continue;
      if (field.type === 'checkbox') {
        if (!(field as HTMLInputElement).checked) invalid.push(name);
      } else if (!String(data.get(name) ?? '').trim()) {
        invalid.push(name);
      }
    }
    const email = String(data.get('email') ?? '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && !invalid.includes('email')) {
      invalid.push('email');
    }
    return [...new Set(invalid)];
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    result.hidden = true;

    const data = new FormData(form);
    const invalid = validate(data);
    if (invalid.length) {
      showErrors(invalid);
      return;
    }

    const idle = button.textContent;
    button.disabled = true;
    button.textContent = button.dataset.sendingLabel ?? idle;

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload.ok) {
        form.reset();
        if (stamp) stamp.value = String(Date.now());
        showResult('success', strings.successTitle, strings.successBody);
      } else if (Array.isArray(payload.fields) && payload.fields.length) {
        showErrors(payload.fields);
      } else {
        showResult(
          'error',
          strings.errorTitle,
          strings.errors[payload.reason] ?? strings.errorBody,
        );
      }
    } catch {
      showResult('error', strings.errorTitle, strings.errorBody);
    } finally {
      button.disabled = false;
      button.textContent = idle;
    }
  });
}

document.querySelectorAll<HTMLFormElement>('form[data-form]').forEach(setup);
