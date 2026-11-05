(function () {
	const initSlider = (root = document) => {
		const sliders = root.querySelectorAll(".product-card-js");

		sliders.forEach((slider) => {
			if (slider.swiper) return;

			const pagination = slider.querySelector(".product-pagination .swiper-pagination");
			const nextButton = slider.querySelector(".product-button-group .swiper-button-next");
			const prevButton = slider.querySelector(".product-button-group .swiper-button-prev");

			new Swiper(slider, {
				pagination: pagination ? { el: pagination, clickable: true } : undefined,
				navigation: nextButton && prevButton
					? { nextEl: nextButton, prevEl: prevButton }
					: undefined,
				allowTouchMove: true,
			});
		});
	};

	initSlider();

	document.addEventListener("shopify:section:load", function (event) {
		initSlider(event.target);
	});
})();
