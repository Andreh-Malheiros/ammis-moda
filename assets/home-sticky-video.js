if (!customElements.get("home-sticky-video")) {
  customElements.define(
    "home-sticky-video",
    class HomeStickyVideo extends HTMLElement {
      static scrollLocks = 0;
      static scrollState = null;

      constructor() {
        super();
        this.isExpanded = false;
        this.feedbackTimer = null;
        this.onTriggerClick = this.expand.bind(this);
        this.onTriggerKeydown = this.handleTriggerKeydown.bind(this);
        this.onCloseClick = this.closeFromControl.bind(this);
        this.onSoundClick = this.toggleSound.bind(this);
        this.onShareClick = this.share.bind(this);
        this.onFavoriteClick = this.toggleFavorite.bind(this);
        this.onBackdropClick = this.closeFromBackdrop.bind(this);
        this.onDocumentKeydown = this.handleDocumentKeydown.bind(this);
        this.stopEvent = this.stopPropagation.bind(this);
      }

      connectedCallback() {
        if (this.initialized) return;

        this.sectionId = this.dataset.sectionId || this.id || "default";
        this.storageKey = `ammis-sticky-video-favorite-${this.sectionId}`;
        this.trigger = this.querySelector("[data-sticky-video-trigger]");
        this.backdrop = this.querySelector("[data-sticky-video-backdrop]");
        this.panel = this.querySelector("[data-sticky-video-panel]");
        this.video = this.querySelector(".home-sticky-video__video");
        this.closeButton = this.querySelector("[data-sticky-video-close]");
        this.soundButton = this.querySelector("[data-sticky-video-sound]");
        this.shareButton = this.querySelector("[data-sticky-video-share]");
        this.favoriteButton = this.querySelector("[data-sticky-video-favorite]");
        this.cta = this.querySelector("[data-sticky-video-cta]");
        this.feedback = this.querySelector("[data-sticky-video-feedback]");
        this.saveFavorite = this.dataset.saveFavorite === "true";
        this.closeOnBackdrop = this.dataset.closeOnBackdrop === "true";
        this.closeOnEscape = this.dataset.closeOnEscape === "true";

        this.trigger?.addEventListener("click", this.onTriggerClick);
        this.trigger?.addEventListener("keydown", this.onTriggerKeydown);
        this.closeButton?.addEventListener("click", this.onCloseClick);
        this.soundButton?.addEventListener("click", this.onSoundClick);
        this.shareButton?.addEventListener("click", this.onShareClick);
        this.favoriteButton?.addEventListener("click", this.onFavoriteClick);
        this.backdrop?.addEventListener("click", this.onBackdropClick);
        this.panel?.addEventListener("click", this.stopEvent);
        this.cta?.addEventListener("click", this.stopEvent);

        this.querySelectorAll(".home-sticky-video__control").forEach((button) => {
          button.addEventListener("click", this.stopEvent);
        });

        this.setMuted(true);
        this.restoreFavorite();
        this.playVideo();
        this.initialized = true;
      }

      disconnectedCallback() {
        this.trigger?.removeEventListener("click", this.onTriggerClick);
        this.trigger?.removeEventListener("keydown", this.onTriggerKeydown);
        this.closeButton?.removeEventListener("click", this.onCloseClick);
        this.soundButton?.removeEventListener("click", this.onSoundClick);
        this.shareButton?.removeEventListener("click", this.onShareClick);
        this.favoriteButton?.removeEventListener("click", this.onFavoriteClick);
        this.backdrop?.removeEventListener("click", this.onBackdropClick);
        this.panel?.removeEventListener("click", this.stopEvent);
        this.cta?.removeEventListener("click", this.stopEvent);
        document.removeEventListener("keydown", this.onDocumentKeydown);

        this.querySelectorAll(".home-sticky-video__control").forEach((button) => {
          button.removeEventListener("click", this.stopEvent);
        });

        if (this.isExpanded) {
          this.close({ returnFocus: false });
        }

        window.clearTimeout(this.feedbackTimer);
        this.initialized = false;
      }

      handleTriggerKeydown(event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        this.expand();
      }

      expand() {
        if (this.isExpanded || !this.panel) return;

        this.isExpanded = true;
        this.dataset.expanded = "true";
        this.previousActiveElement = document.activeElement;
        this.backdrop.hidden = false;
        this.panel.setAttribute("aria-hidden", "false");
        this.trigger?.setAttribute("aria-expanded", "true");
        this.setMuted(true);
        this.lockScroll();
        document.addEventListener("keydown", this.onDocumentKeydown);
        this.playVideo();
        this.closeButton?.focus({ preventScroll: true });
      }

      closeFromControl(event) {
        event.preventDefault();
        event.stopPropagation();
        this.close({ returnFocus: true });
      }

      closeFromBackdrop(event) {
        if (!this.closeOnBackdrop || event.target !== this.backdrop) return;
        this.close({ returnFocus: false });
      }

      close(options = {}) {
        if (!this.isExpanded) return;

        this.isExpanded = false;
        this.dataset.expanded = "false";
        this.trigger?.setAttribute("aria-expanded", "false");
        this.panel?.setAttribute("aria-hidden", "true");
        this.backdrop.hidden = true;
        this.setMuted(true);
        this.playVideo();
        this.unlockScroll();
        document.removeEventListener("keydown", this.onDocumentKeydown);

        if (options.returnFocus !== false) {
          const focusTarget = this.previousActiveElement === this.trigger ? this.trigger : this.trigger;
          focusTarget?.focus({ preventScroll: true });
        }
      }

      handleDocumentKeydown(event) {
        if (!this.isExpanded) return;

        if (event.key === "Escape" && this.closeOnEscape) {
          event.preventDefault();
          this.close({ returnFocus: true });
          return;
        }

        if (event.key === "Tab") {
          this.trapFocus(event);
        }
      }

      trapFocus(event) {
        const focusable = this.getFocusableElements();
        if (!focusable.length) {
          event.preventDefault();
          this.panel?.focus({ preventScroll: true });
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        }
      }

      getFocusableElements() {
        if (!this.panel) return [];

        return Array.from(
          this.panel.querySelectorAll(
            'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])'
          )
        ).filter((element) => element.offsetParent !== null);
      }

      toggleSound(event) {
        event.preventDefault();
        event.stopPropagation();
        if (!this.soundButton || !this.video) return;

        const shouldUnmute = this.video.muted;
        this.setMuted(!shouldUnmute);
        this.playVideo();
      }

      setMuted(isMuted) {
        if (this.video) {
          this.video.muted = isMuted;
          this.video.defaultMuted = isMuted;
        }

        if (this.soundButton) {
          this.soundButton.setAttribute("aria-pressed", String(!isMuted));
          this.soundButton.setAttribute("aria-label", isMuted ? "Ativar som" : "Desativar som");
          this.querySelector(".home-sticky-video__icon--sound-off")?.toggleAttribute("hidden", !isMuted);
          this.querySelector(".home-sticky-video__icon--sound-on")?.toggleAttribute("hidden", isMuted);
        }
      }

      toggleFavorite(event) {
        event.preventDefault();
        event.stopPropagation();
        if (!this.favoriteButton) return;

        const isFavorite = this.favoriteButton.getAttribute("aria-pressed") === "true";
        this.setFavorite(!isFavorite);
      }

      setFavorite(isFavorite) {
        if (!this.favoriteButton) return;

        this.favoriteButton.setAttribute("aria-pressed", String(isFavorite));
        this.favoriteButton.setAttribute(
          "aria-label",
          isFavorite ? "Remover favorito do vídeo" : "Favoritar vídeo"
        );

        if (!this.saveFavorite) return;

        try {
          window.localStorage.setItem(this.storageKey, isFavorite ? "true" : "false");
        } catch (error) {
          // Storage can be unavailable in private contexts.
        }
      }

      restoreFavorite() {
        if (!this.favoriteButton || !this.saveFavorite) return;

        try {
          this.setFavorite(window.localStorage.getItem(this.storageKey) === "true");
        } catch (error) {
          this.setFavorite(false);
        }
      }

      async share(event) {
        event.preventDefault();
        event.stopPropagation();

        const url = this.getShareUrl();

        if (navigator.share) {
          try {
            await navigator.share({ url });
            return;
          } catch (error) {
            if (error && error.name === "AbortError") return;
          }
        }

        const copied = await this.copyToClipboard(url);
        if (copied) this.showFeedback();
      }

      getShareUrl() {
        const configuredUrl = this.dataset.destinationUrl;
        if (configuredUrl) {
          try {
            return new URL(configuredUrl, window.location.origin).href;
          } catch (error) {
            return configuredUrl;
          }
        }

        return window.location.href;
      }

      async copyToClipboard(text) {
        if (navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(text);
            return true;
          } catch (error) {
            return this.fallbackCopy(text);
          }
        }

        return this.fallbackCopy(text);
      }

      fallbackCopy(text) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "-9999px";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();

        try {
          return document.execCommand("copy");
        } catch (error) {
          return false;
        } finally {
          textarea.remove();
        }
      }

      showFeedback() {
        if (!this.feedback) return;

        window.clearTimeout(this.feedbackTimer);
        this.feedback.hidden = false;

        this.feedbackTimer = window.setTimeout(() => {
          this.feedback.hidden = true;
        }, 2200);
      }

      playVideo() {
        if (!this.video) return;

        const playPromise = this.video.play();
        if (playPromise?.catch) {
          playPromise.catch(() => {});
        }
      }

      lockScroll() {
        if (HomeStickyVideo.scrollLocks === 0) {
          const body = document.body;
          const html = document.documentElement;
          const scrollY = window.scrollY || window.pageYOffset;

          HomeStickyVideo.scrollState = {
            scrollY,
            bodyPosition: body.style.position,
            bodyTop: body.style.top,
            bodyWidth: body.style.width,
            bodyOverflow: body.style.overflow,
            htmlOverflow: html.style.overflow,
          };

          html.style.overflow = "hidden";
          body.style.overflow = "hidden";
          body.style.position = "fixed";
          body.style.top = `-${scrollY}px`;
          body.style.width = "100%";
        }

        HomeStickyVideo.scrollLocks += 1;
      }

      unlockScroll() {
        if (HomeStickyVideo.scrollLocks <= 0) return;

        HomeStickyVideo.scrollLocks -= 1;
        if (HomeStickyVideo.scrollLocks > 0 || !HomeStickyVideo.scrollState) return;

        const body = document.body;
        const html = document.documentElement;
        const state = HomeStickyVideo.scrollState;

        body.style.position = state.bodyPosition;
        body.style.top = state.bodyTop;
        body.style.width = state.bodyWidth;
        body.style.overflow = state.bodyOverflow;
        html.style.overflow = state.htmlOverflow;
        window.scrollTo(0, state.scrollY);
        HomeStickyVideo.scrollState = null;
      }

      stopPropagation(event) {
        event.stopPropagation();
      }
    }
  );
}
