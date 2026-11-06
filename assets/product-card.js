const generateSrcset = (image, widths = []) => {
  const imageUrl = new URL(image["src"]);
  return widths.filter((width) => width <= image["width"]).map((width) => {
    imageUrl.searchParams.set("width", width.toString());
    return `${imageUrl.href} ${width}w`;
  }).join(", ");
}

const createImageElement = (image, classes, sizes, productTitle) => {
  const previewImage = image["preview_image"];
  const newImage = new Image(previewImage["width"], previewImage["height"]);
  newImage.className = classes;
  newImage.alt = image["alt"] || productTitle;
  newImage.sizes = sizes;
  newImage.src = previewImage["src"];
  newImage.srcset = generateSrcset(previewImage, [165, 360, 533, 720, 940, 1066]);
  newImage.loading="lazy"
  return newImage;
}

const checkSwatches = (root = document) => {
  const wrappers = root.matches?.('.js-color-swatches-wrapper')
    ? [root]
    : root.querySelectorAll('.js-color-swatches-wrapper');
  wrappers.forEach(wrapper => {
    wrapper.querySelectorAll('.js-color-swatches input').forEach(input => {
      if (input.dataset.retailCardColorListener === 'true') return;
      input.dataset.retailCardColorListener = 'true';

      input.addEventListener('click', (event) => {
        const primaryImage = wrapper.querySelector(".media--first");
        const secondaryImage = wrapper.querySelector(".media--second");
        const handleProduct = wrapper.dataset.product;

        if (event.currentTarget.checked) {
          const productLink = wrapper.querySelector('.js-color-swatches-link');
          if (productLink && event.currentTarget.dataset.variantLink) {
            productLink.setAttribute('href', event.currentTarget.dataset.variantLink);
          }

          const sizeOptions = wrapper.querySelector('[data-retail-card-sizes]');
          if (sizeOptions) {
            sizeOptions.querySelectorAll('[data-retail-card-size-color]').forEach((group) => {
              group.hidden = group.dataset.retailCardSizeColor !== event.currentTarget.value;
            });
          }

          const addButton = wrapper.querySelector('.card__add-to-cart button[name="add"]');
          if (addButton) {
            const canPurchase = event.currentTarget.dataset.variantAvailable !== 'false' &&
              Boolean(event.currentTarget.dataset.variantId);
            addButton.disabled = !canPurchase;
            addButton.setAttribute('aria-disabled', String(!canPurchase));
            const label = addButton.querySelector('span:not(.sold-out-message)');
            const soldOut = addButton.querySelector('.sold-out-message');
            label?.classList.toggle('hidden', !canPurchase);
            soldOut?.classList.toggle('hidden', canPurchase);
            const variantInput = wrapper.querySelector('.card__add-to-cart input[name="id"]');
            if (variantInput) {
              variantInput.value = event.currentTarget.dataset.variantId || '';
              variantInput.disabled = !canPurchase;
            }
          }

          const currentColor = event.currentTarget.value;

          if (!primaryImage) return;

          jQuery.getJSON(window.Shopify.routes.root + `products/${handleProduct}.js`, function(product) {
            const variant = product.variants.filter(item => item.featured_media != null && item.options.includes(currentColor))[0];

            if (variant) {
              const newPrimaryImage = createImageElement(variant["featured_media"], primaryImage.className, primaryImage.sizes, product.title);
              
              if (newPrimaryImage.src !== primaryImage.src) {
                let flag = false;
                if (secondaryImage) {
                  const secondaryImagePathname = new URL(secondaryImage.src).pathname;
                  const newPrimaryImagePathname = new URL(newPrimaryImage.src).pathname;

                  if (secondaryImagePathname == newPrimaryImagePathname) {
                    primaryImage.remove();
                    secondaryImage.classList.remove('media--second');
                    secondaryImage.classList.add('media--first');
                    flag = true;
                  } 
                }
                if (flag == false) {
                  primaryImage.animate({ opacity: [1, 0] }, { duration: 200, easing: "ease-in", fill: "forwards" }).finished;
                  setTimeout(function(){
                    primaryImage.replaceWith(newPrimaryImage);
                    newPrimaryImage.animate({ opacity: [0, 1] }, { duration: 200, easing: "ease-in" });
                    if (secondaryImage) {
                      secondaryImage.remove();                                    
                    }
                  }, 200);
                }
              }
            }
          });
        }
      })
    })
  })
}

window.initRetailCardSwatches = checkSwatches;
document.dispatchEvent(new Event('retail-card-swatches:ready'));

function colorSwatches() {
  checkSwatches();

  document.addEventListener('shopify:section:load', function () {
    checkSwatches();
  });
}

(function () {
colorSwatches();
})()
