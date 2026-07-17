(function () {
	const initCollapsibleContent = () => {
		$(".collapsible-content__toggle").unbind("click").on("click", function () {
			const parent = $(this).parent();

			if (!parent.hasClass("active")) {
				parent
					.siblings(".collapsible-content__item.active")
					.removeClass("active");
				parent.addClass("active");
				$(this)
					.closest(".collapsible-content__items")
					.find(".collapsible-content__answer")
					.stop()
					.slideUp(300);
				$(this).next().stop().slideDown(300);
			} else {
				parent.removeClass("active");
				$(this).next().stop().slideUp(300);
			}
		});
	};

	const initGallery = () => {
		$(document).ready(() => {
			if($('.collapsible-content__gallery--image-wrapper').length > 0) {
					var images = $('.collapsible-content__gallery--image-wrapper');
					var currentImageIndex = 0;
					
					images.eq(currentImageIndex).fadeIn();

					var interval = setInterval(function() {
							images.eq(currentImageIndex).fadeOut();

							currentImageIndex++;
							if (currentImageIndex >= images.length) {
									currentImageIndex = 0; // Go back to the first image
							}

							images.eq(currentImageIndex).fadeIn();
					}, 4000); // Change image every 3 seconds (adjust as needed)
				}
		});
	};

	document.addEventListener("shopify:section:load", function () {
		initCollapsibleContent();
	});

	initCollapsibleContent();
	initGallery();
})();
