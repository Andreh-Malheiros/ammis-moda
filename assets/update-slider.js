(function () {
	function refreshGalleryAfterImageLoad() {
		document.querySelectorAll(".js-media-list").forEach((elem) => {
			const slider = elem.swiper;
			if (!slider) return;

			const updateGallery = () => {
				window.requestAnimationFrame(() => {
					if (!slider.destroyed) slider.update();
				});
			};

			let waitingForImage = false;
			elem.querySelectorAll("img").forEach((image) => {
				if (image.complete) return;
				waitingForImage = true;
				image.addEventListener("load", updateGallery, { once: true });
				image.addEventListener("error", updateGallery, { once: true });
			});

			if (!waitingForImage) updateGallery();
		});
	}

	function swiperInit() {
		subSliderInit(true);
		sliderInit(true);
		refreshGalleryAfterImageLoad();
		popupSliderInit(true);
	}

	document.addEventListener('shopify:section:load', function (e) {
		swiperInit();
	});

	swiperInit();
})();
