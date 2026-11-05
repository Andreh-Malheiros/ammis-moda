(() => {
  function init() {
    const form = document.getElementById('b2b-ajax-search-form');
    if (!form || form.dataset.searchReady) return;
    form.dataset.searchReady = 'true';
    const input = form.querySelector('input[type="search"]');
    const wrapper = document.getElementById('catalogo-atacado');
    const grid = wrapper?.querySelector('.b2b-grid');
    const feedback = wrapper?.querySelector('.b2b-search-feedback');
    const status = feedback?.querySelector('.b2b-search-status');
    const clear = feedback?.querySelector('.b2b-search-clear');
    let revision = 0;
    let catalogLoading;
    const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
    const cards = () => Array.from(grid.querySelectorAll(':scope > .b2b-card'));
    const showStatus = text => {
      feedback.hidden = false;
      status.textContent = text;
      status.focus({ preventScroll: true });
      status.scrollIntoView({ block: 'center', behavior: 'instant' });
    };
    const updateUrl = query => {
      const url = new URL(window.location.href);
      if (query) url.searchParams.set('b2b_q', query);
      else url.searchParams.delete('b2b_q');
      window.history.replaceState(null, '', url);
    };
    async function loadCatalog() {
      while (grid.dataset.nextPage) {
        const url = new URL(grid.dataset.nextPage, window.location.origin);
        url.searchParams.set('section_id', grid.dataset.sectionId);
        const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error('Catalog request failed');
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const nextGrid = doc.querySelector('.b2b-grid');
        if (!nextGrid) throw new Error('Catalog not found');
        const nextPage = nextGrid.dataset.nextPage || '';
        if (nextPage === grid.dataset.nextPage) throw new Error('Catalog pagination did not advance');
        grid.append(...nextGrid.querySelectorAll(':scope > .b2b-card'));
        grid.dataset.nextPage = nextPage;
      }
    }
    async function search(query) {
      const current = ++revision;
      input.setCustomValidity('');
      if (!grid || !status || !clear) {
        const url = new URL(form.dataset.catalogUrl, window.location.origin);
        if (url.pathname === window.location.pathname) {
          input.setCustomValidity(form.dataset.error);
          input.reportValidity();
          return;
        }
        url.searchParams.set('b2b_q', query);
        url.hash = 'catalogo-atacado';
        window.location.assign(url);
        return;
      }
      if (!query) {
        cards().forEach(card => { card.hidden = false; });
        feedback.hidden = true;
        grid.removeAttribute('aria-busy');
        updateUrl('');
        return;
      }
      document.getElementById('b2b-search-overlay').style.display = 'none';
      grid.setAttribute('aria-busy', 'true');
      showStatus(status.dataset.loading);
      try {
        if (!catalogLoading) catalogLoading = loadCatalog().catch(error => { catalogLoading = null; throw error; });
        await catalogLoading;
        if (current !== revision) return;
        const terms = normalize(query).split(/\s+/).filter(Boolean);
        let count = 0;
        cards().forEach(card => {
          const text = normalize(card.dataset.searchText || card.querySelector('h3')?.textContent || '');
          card.hidden = !terms.every(term => text.includes(term));
          if (!card.hidden) count++;
        });
        updateUrl(query);
        showStatus((count ? status.dataset.results : status.dataset.empty)
          .replace('__count__', String(count)).replace('__query__', query));
      } catch (error) {
        if (current === revision) showStatus(status.dataset.error);
      } finally {
        if (current === revision) grid.removeAttribute('aria-busy');
      }
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      search(input.value.trim());
    });
    input.addEventListener('input', () => input.setCustomValidity(''));
    clear?.addEventListener('click', () => {
      input.value = '';
      search('');
      wrapper.querySelector('h2')?.scrollIntoView({ block: 'center', behavior: 'instant' });
      const opener = document.querySelector('.b2b-header-search-icon');
      opener?.focus({ preventScroll: true });
    });
    const initialQuery = new URL(window.location.href).searchParams.get('b2b_q');
    if (initialQuery) {
      input.value = initialQuery;
      search(initialQuery.trim());
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  document.addEventListener('shopify:section:load', init);
})();
