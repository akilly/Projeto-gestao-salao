/** Validação compartilhada: mensagem inline e foco, sem balões nativos. */
export function validateVisibleControls(form) {
    if (!form?.querySelectorAll) return true;
    const invalid = [...form.querySelectorAll('input, select, textarea')].find(el => el.willValidate && !el.closest('[hidden]') && !el.checkValidity());
    if (!invalid) return true;
    let error = form.querySelector('[role="alert"]');
    if (!error) { error = document.createElement('div'); error.className = 'form-error'; error.setAttribute('role', 'alert'); form.prepend(error); }
    if (!error.id) error.id = 'validation-error';
    const label = invalid.getAttribute('aria-label') || invalid.labels?.[0]?.querySelector('span')?.textContent || invalid.labels?.[0]?.childNodes?.[0]?.textContent?.trim() || invalid.name || 'Campo';
    error.textContent = label + ': ' + (invalid.validity.valueMissing ? 'preencha este campo.' : invalid.validity.rangeUnderflow ? 'use um valor igual ou maior que ' + invalid.min + '.' : invalid.validity.rangeOverflow ? 'use um valor igual ou menor que ' + invalid.max + '.' : 'confira o formato e o valor informado.');
    invalid.setAttribute('aria-invalid', 'true'); invalid.setAttribute('aria-describedby', error.id); invalid.focus();
    return false;
}
