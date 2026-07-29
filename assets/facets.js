class FacetFiltersForm extends HTMLElement {
	constructor() {
		super();
		this.onActiveFilterClick = this.onActiveFilterClick.bind(this);

		this.debouncedOnSubmit = debounce((event) => {
			this.onSubmitHandler(event);
		}, 500);

		const facetForm = this.querySelector("form");
		if (facetForm) {
			facetForm.addEventListener("input", this.debouncedOnSubmit);
		}

		const facetWrapper = this.querySelector("#FacetsWrapperDesktop");
		if (facetWrapper) facetWrapper.addEventListener("keyup", onKeyUpEscape);

		const facetButton = this.querySelector(".facets__button-show");
		if (facetButton) {
			facetButton.onclick = (event) => {
				const labelHide = event.currentTarget.querySelector(".label-hide");
				const labelShow = event.currentTarget.querySelector(".label-show");
				if (!labelHide || !labelShow) return;

				labelHide.classList.toggle("hidden");
				labelShow.classList.toggle("hidden");

				const form = labelHide.closest("form");
				const container = form?.querySelector(".facets__container");
				if (!container) return;

				container.classList.toggle("active");
				document.body.classList.toggle("overflow-hidden");
				document.body.classList.toggle("filter-open");

				const horizontalFilters = document.querySelector(
					".facets__container--horizontal:not(.active)"
				);
				if (horizontalFilters) {
					horizontalFilters.classList.add("visible_container");
					setTimeout(
						() => horizontalFilters.classList.remove("visible_container"),
						600
					);
				}

				container.addEventListener(
					"click",
					() => {
						if (container.querySelector(".facets__wrapper:hover") == null) {
							container.classList.remove("active");
							document.body.classList.remove("overflow-hidden");
							setTimeout(
								() => document.body.classList.remove("filter-open"),
								700
							);
						}
					},
					{ once: true }
				);
			};

			const select = document.getElementById("SortBy");
			if (select) {
				select.addEventListener("click", () => select.classList.toggle("open"));
				select.addEventListener("blur", () => select.classList.remove("open"));
			}

			const facetCloseButton = this.querySelector(".facets-modal__close");
			if (facetCloseButton) {
				facetCloseButton.addEventListener("click", () => {
					const container = facetCloseButton.closest(".facets__container");
					if (container) container.classList.remove("active");
					document.body.classList.remove("overflow-hidden");
					setTimeout(() => document.body.classList.remove("filter-open"), 700);
				});
			}
		}

		this.updateMobileTagState();
	}

	updateMobileTagState() {
		const checkboxes = document.querySelectorAll(
			'#FacetFiltersFormMobile .js-filter input[type="checkbox"]'
		);
		const removebtn = document.querySelector(
			"#FacetFiltersFormMobile .facets-tag-wrapper"
		);
		const anyChecked = Array.from(checkboxes).some(
			(checkbox) => checkbox.checked
		);

		removebtn?.classList.toggle("active", !anyChecked);
	}

	static setListeners() {
		const onHistoryChange = (event) => {
			const searchParams = event.state
				? event.state.searchParams
				: window.location.search.slice(1);

			if (searchParams === FacetFiltersForm.searchParamsPrev) return;
			FacetFiltersForm.renderPage(searchParams, null, false);
		};

		window.addEventListener("popstate", onHistoryChange);
	}

	static toggleActiveFacets(disable = true) {
		document.querySelectorAll(".js-facet-remove").forEach((element) => {
			element.classList.toggle("disabled", disable);
		});
	}

	static setLoading(isLoading) {
		const productGridContainer = document.getElementById("ProductGridContainer");
		const collection = productGridContainer?.querySelector(".collection");
		const countContainer = document.getElementById("ProductCount");
		const countContainerDesktop = document.getElementById("ProductCountDesktop");

		collection?.classList.toggle("loading", isLoading);
		countContainer?.classList.toggle("loading", isLoading);
		countContainerDesktop?.classList.toggle("loading", isLoading);
	}

	static renderPage(searchParams, event, updateURLHash = true) {
		FacetFiltersForm.searchParamsPrev = searchParams;

		const sections = FacetFiltersForm.getSections();
		if (sections.length === 0) {
			console.error("FacetFiltersForm: seção da grade de produtos não encontrada.");
			return;
		}

		FacetFiltersForm.setLoading(true);
		FacetFiltersForm.toggleActiveFacets(true);

		if (FacetFiltersForm.abortController) {
			FacetFiltersForm.abortController.abort();
		}

		FacetFiltersForm.abortController = new AbortController();
		const requestId = ++FacetFiltersForm.requestId;

		sections.forEach((section) => {
			const separator = searchParams ? "&" : "";
			const url = `${window.location.pathname}?section_id=${section.section}${separator}${searchParams}`;
			FacetFiltersForm.renderSectionFromFetch(
				url,
				event,
				requestId,
				FacetFiltersForm.abortController.signal
			);
		});

		if (updateURLHash) FacetFiltersForm.updateURLHash(searchParams);
	}

	static async renderSectionFromFetch(url, event, requestId, signal) {
		try {
			const response = await fetch(url, {
				signal,
				headers: {
					"X-Requested-With": "XMLHttpRequest",
				},
			});

			if (!response.ok) {
				throw new Error(`Falha ao carregar os filtros: HTTP ${response.status}`);
			}

			const html = await response.text();

			if (requestId !== FacetFiltersForm.requestId) return;

			const parsedHTML = new DOMParser().parseFromString(html, "text/html");
			if (!parsedHTML.getElementById("ProductGridContainer")) {
				throw new Error("Resposta da seção sem ProductGridContainer.");
			}

			FacetFiltersForm.renderFilters(parsedHTML, event);
			FacetFiltersForm.renderProductGridContainer(parsedHTML);
			FacetFiltersForm.renderProductCount(parsedHTML);
			FacetFiltersForm.initializeProductCardSliders();
		} catch (error) {
			if (error.name === "AbortError") return;

			console.error("FacetFiltersForm:", error);
			FacetFiltersForm.showLoadError();
		} finally {
			if (requestId === FacetFiltersForm.requestId) {
				FacetFiltersForm.setLoading(false);
				FacetFiltersForm.toggleActiveFacets(false);
			}
		}
	}

	static showLoadError() {
		const grid = document.getElementById("ProductGridContainer");
		if (!grid) return;

		let message = grid.querySelector(".facets-load-error");
		if (!message) {
			message = document.createElement("div");
			message.className = "facets-load-error";
			message.setAttribute("role", "alert");
			message.textContent =
				"Não foi possível atualizar os produtos. Recarregue a página e tente novamente.";
			grid.prepend(message);
		}
	}

	static initializeProductCardSliders() {
		if (typeof Swiper !== "function") return;

		document.querySelectorAll(".product-card-js").forEach((slider) => {
			if (slider.swiper) return;

			new Swiper(slider, {
				pagination: {
					el: slider.querySelector(".product-pagination .swiper-pagination"),
					clickable: true,
				},
				navigation: {
					nextEl: slider.querySelector(".product-button-group .swiper-button-next"),
					prevEl: slider.querySelector(".product-button-group .swiper-button-prev"),
				},
				allowTouchMove: true,
				breakpoints: {
					990: {
						allowTouchMove: false,
					},
				},
			});
		});
	}

	static renderProductGridContainer(parsedHTML) {
		const currentContainer = document.getElementById("ProductGridContainer");
		const newContainer = parsedHTML.getElementById("ProductGridContainer");
		if (!currentContainer || !newContainer) return;

		currentContainer.innerHTML = newContainer.innerHTML;

		if (
			typeof loadMore === "function" &&
			(document.querySelector(".js-load-more") ||
				document.querySelector(".js-infinite-scroll"))
		) {
			loadMore();
		}

		if (typeof colorSwatches === "function") {
			colorSwatches();
		}
	}

	static renderProductCount(parsedHTML) {
		const sourceCount = parsedHTML.getElementById("ProductCount");
		const container = document.getElementById("ProductCount");
		const containerDesktop = document.getElementById("ProductCountDesktop");
		if (!sourceCount) return;

		if (container) container.innerHTML = sourceCount.innerHTML;
		if (containerDesktop) containerDesktop.innerHTML = sourceCount.innerHTML;
	}

	static renderFilters(parsedHTML, event) {
		const facetDetailsElements = parsedHTML.querySelectorAll(
			"#FacetFiltersForm .js-filter, #FacetFiltersFormMobile .js-filter, #FacetFiltersPillsForm .js-filter"
		);

		const activeFilter = event?.target?.closest?.(".js-filter");
		const matchesIndex = (element) =>
			activeFilter
				? element.dataset.index === activeFilter.dataset.index
				: false;

		const facetsToRender = Array.from(facetDetailsElements).filter(
			(element) => !matchesIndex(element)
		);
		const countsToRender = Array.from(facetDetailsElements).find(matchesIndex);

		facetsToRender.forEach((element) => {
			document.querySelectorAll(".js-filter").forEach((target) => {
				if (target.dataset.index === element.dataset.index) {
					target.innerHTML = element.innerHTML;
				}
			});
		});

		FacetFiltersForm.renderActiveFacets(parsedHTML);
		FacetFiltersForm.renderAdditionalElements(parsedHTML);

		if (countsToRender && activeFilter) {
			FacetFiltersForm.renderCounts(countsToRender, activeFilter);
		}

		const checkboxes = document.querySelectorAll(
			'#FacetFiltersFormMobile .js-filter input[type="checkbox"]'
		);
		const removebtn = document.querySelector(
			"#FacetFiltersFormMobile .facets-tag-wrapper"
		);
		const anyChecked = Array.from(checkboxes).some(
			(checkbox) => checkbox.checked
		);
		removebtn?.classList.toggle("active", !anyChecked);
	}

	static renderActiveFacets(html) {
		const activeFacetElementSelectors = [
			".active-facets-mobile",
			".active-facets-desktop",
		];

		activeFacetElementSelectors.forEach((selector) => {
			const source = html.querySelector(selector);
			const target = document.querySelector(selector);
			if (source && target) target.innerHTML = source.innerHTML;
		});
	}

	static renderAdditionalElements(html) {
		const mobileElementSelectors = [
			".mobile-facets__open",
			".mobile-facets__count",
			".sorting",
		];

		mobileElementSelectors.forEach((selector) => {
			const source = html.querySelector(selector);
			const target = document.querySelector(selector);
			if (source && target) target.innerHTML = source.innerHTML;
		});
	}

	static renderCounts(source, target) {
		if (!source || !target) return;

		const sourceSelected = source.querySelector(".facets__selected");
		const targetSelected = target.querySelector(".facets__selected");
		if (sourceSelected && targetSelected) {
			targetSelected.outerHTML = sourceSelected.outerHTML;
		}

		const sourceSummary = source.querySelector(".facets__summary");
		const targetSummary = target.querySelector(".facets__summary");
		if (sourceSummary && targetSummary) {
			targetSummary.outerHTML = sourceSummary.outerHTML;
		}
	}

	static updateURLHash(searchParams) {
		history.pushState(
			{ searchParams },
			"",
			`${window.location.pathname}${searchParams ? `?${searchParams}` : ""}`
		);
	}

	static getSections() {
		const productGrid = document.getElementById("product-grid");
		if (!productGrid?.dataset?.id) return [];

		return [{ section: productGrid.dataset.id }];
	}

	createSearchParams(form) {
		if (!form) return "";
		const formData = new FormData(form);
		return new URLSearchParams(formData).toString();
	}

	onSubmitForm(searchParams, event) {
		FacetFiltersForm.renderPage(searchParams, event);
	}

	onSubmitHandler(event) {
		event.preventDefault();

		const target = event.target;
		const currentForm = target?.closest?.("form");
		if (!currentForm) return;

		const sortFilterForms = document.querySelectorAll(
			"facet-filters-form form"
		);

		if (target.classList?.contains("mobile-facets__checkbox")) {
			this.onSubmitForm(this.createSearchParams(currentForm), event);
			return;
		}

		const forms = [];
		sortFilterForms.forEach((form) => {
			if (
				form.id === "FacetSortForm" ||
				form.id === "FacetFiltersForm" ||
				form.id === "FacetFiltersFormMobile" ||
				form.id === "FacetSortDrawerForm"
			) {
				document.querySelectorAll(".no-js-list").forEach((el) => el.remove());

				if (currentForm === form) {
					forms.push(this.createSearchParams(form));
				} else {
					const params = this.createSearchParams(form)
						.split("&")
						.filter((element) => !element.startsWith("filter.p.product_type"))
						.join("&");
					forms.push(params);
				}
			}
		});

		const searchParams = forms.filter(Boolean).join("&");
		this.onSubmitForm(searchParams, event);
	}

	onActiveFilterClick(event) {
		event.preventDefault();
		FacetFiltersForm.toggleActiveFacets();

		const href = event.currentTarget.href;
		const searchParams = href.includes("?") ? href.split("?")[1] : "";
		FacetFiltersForm.renderPage(searchParams);

		const removebtn = document.querySelector(
			"#FacetFiltersFormMobile .facets-tag-wrapper"
		);
		removebtn?.classList.add("active");
	}
}

FacetFiltersForm.abortController = null;
FacetFiltersForm.requestId = 0;
FacetFiltersForm.searchParamsInitial = window.location.search.slice(1);
FacetFiltersForm.searchParamsPrev = window.location.search.slice(1);

if (!customElements.get("facet-filters-form")) {
	customElements.define("facet-filters-form", FacetFiltersForm);
}
FacetFiltersForm.setListeners();

class PriceRange extends HTMLElement {
	constructor() {
		super();
		this.querySelectorAll("input").forEach((element) =>
			element.addEventListener("change", this.onRangeChange.bind(this))
		);
		this.setMinAndMaxValues();
		this.controlSlider();
		this.controlInput();
	}

	onRangeChange(event) {
		this.adjustToValidValues(event.currentTarget);
		this.setMinAndMaxValues();
	}

	setMinAndMaxValues() {
		const inputs = this.querySelectorAll("input");
		const minInput = inputs[0];
		const maxInput = inputs[1];
		if (maxInput.value) minInput.setAttribute("max", maxInput.value);
		if (minInput.value) maxInput.setAttribute("min", minInput.value);
		if (minInput.value === "") maxInput.setAttribute("min", 0);
		if (maxInput.value === "")
			minInput.setAttribute("max", maxInput.getAttribute("max"));
	}

	adjustToValidValues(input) {
		const value = Number(input.value);
		const min = Number(input.getAttribute("min"));
		const max = Number(input.getAttribute("max"));

		if (value < min) input.value = min;
		if (value > max) input.value = max;
	}

	fillSlider() {
		const inputRangeWrappers = document.querySelectorAll(
			".facets__price .facets__range"
		);
		inputRangeWrappers.forEach((inputWrapper) => {
			const inputsRange = inputWrapper.querySelectorAll(".field__range");
			const inputRangeFrom = inputsRange[0];
			const inputRangeTo = inputsRange[1];

			const range = inputRangeTo.max - inputRangeTo.min;
			const fromCurrent = inputRangeFrom.value - inputRangeTo.min;
			const toCurrent = inputRangeTo.value - inputRangeTo.min;
			const minRange = (fromCurrent / range) * 100;
			const maxRange = (toCurrent / range) * 100;

			inputWrapper.setAttribute(
				"style",
				`--range-min: ${minRange}%; --range-max: ${maxRange}%`
			);
		});
	}

	controlSlider() {
		const inputRangeWrappers = document.querySelectorAll(
			".facets__price .facets__range"
		);
		const inputNumberWrappers = document.querySelectorAll(
			".facets__price .facets__price-wrapper"
		);

		inputRangeWrappers.forEach((inputWrapper, index) => {
			const inputsRange = inputWrapper.querySelectorAll(".field__range");
			const inputRangeFrom = inputsRange[0];
			const inputRangeTo = inputsRange[1];
			const inputNumberFrom =
				inputNumberWrappers[index].querySelectorAll(".field__input")[0];
			const inputNumberTo =
				inputNumberWrappers[index].querySelectorAll(".field__input")[1];

			inputRangeFrom.oninput = () => {
				const from = parseInt(inputRangeFrom.value, 10);
				const to = parseInt(inputRangeTo.value, 10);
				if (from > to) {
					inputRangeFrom.value = to;
					inputNumberFrom.value = to;
				} else {
					inputNumberFrom.value = from;
				}

				this.fillSlider();
			};

			if (Number(inputRangeTo.value) <= 0) {
				inputRangeTo.style.zIndex = 2;
			} else {
				inputRangeTo.style.zIndex = 0;
			}

			inputRangeTo.oninput = () => {
				const from = parseInt(inputRangeFrom.value, 10);
				const to = parseInt(inputRangeTo.value, 10);
				if (from <= to) {
					inputRangeTo.value = to;
					inputNumberTo.value = to;
				} else {
					inputNumberTo.value = from;
					inputRangeTo.value = from;
				}

				if (Number(inputRangeTo.value) <= 0) {
					inputRangeTo.style.zIndex = 2;
				} else {
					inputRangeTo.style.zIndex = 0;
				}

				this.fillSlider();
			};
		});
	}

	controlInput() {
		const inputRangeWrappers = document.querySelectorAll(
			".facets__price .facets__range"
		);
		const inputNumberWrappers = document.querySelectorAll(
			".facets__price .facets__price-wrapper"
		);

		inputNumberWrappers.forEach((inputWrapper, index) => {
			const inputsNumber = inputWrapper.querySelectorAll(".field__input");
			const inputNumberFrom = inputsNumber[0];
			const inputNumberTo = inputsNumber[1];
			const inputRangeFrom =
				inputRangeWrappers[index].querySelectorAll(".field__range")[0];
			const inputRangeTo =
				inputRangeWrappers[index].querySelectorAll(".field__range")[1];

			inputNumberFrom.oninput = () => {
				const from = parseInt(inputNumberFrom.value, 10);
				const to = parseInt(inputNumberTo.value, 10);
				if (from > to) {
					inputRangeFrom.value = to;
					inputNumberFrom.value = to;
				} else {
					inputRangeFrom.value = from;
				}

				this.fillSlider();
			};

			inputNumberTo.oninput = () => {
				const from = parseInt(inputNumberFrom.value, 10);
				const to = parseInt(inputNumberTo.value, 10);
				if (from <= to) {
					inputRangeTo.value = to;
					inputNumberTo.value = to;
				} else {
					inputNumberTo.value = from;
				}

				this.fillSlider();
			};
		});
	}
}

customElements.define("price-range", PriceRange);

class FacetRemove extends HTMLElement {
	constructor() {
		super();
		const facetLink = this.querySelector("a");
		facetLink.setAttribute("role", "button");
		facetLink.addEventListener("click", this.closeFilter.bind(this));
		facetLink.addEventListener("keyup", (event) => {
			event.preventDefault();
			if (event.code.toUpperCase() === "SPACE") this.closeFilter(event);
		});
	}

	closeFilter(event) {
		event.preventDefault();
		const form =
			this.closest("facet-filters-form") ||
			document.querySelector("facet-filters-form");
		form.onActiveFilterClick(event);
	}
}

customElements.define("facet-remove", FacetRemove);