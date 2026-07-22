if (!customElements.get("home-sticky-video")) {
  customElements.define(
    "home-sticky-video",
    class HomeStickyVideo extends HTMLElement {
      constructor() {
        super();
        this.isExpanded = false;
        this.feedbackTimer = null;
        this.onTriggerClick = this.expand.bind(this);
        this.onTriggerKeydown = this.handleTriggerKeydown.bind(this);
        this.onCloseClick = this.close.bind(this);
        this.onSoundClick = this.toggleSound.bind(this);
        this.onShareClick = this.share.bind(this);
        this.onFavoriteClick = this.toggleFavorite.bind(this);
        this.stopEvent = this.stopPropagation.bind(this);
      }

      connectedCallback() {
        if (this.initialized) return;

        this.sectionId = this.dataset.sectionId || this.id || "default";
        this.storageKey = `ammis-sticky-video-favorite-${this.sectionId}`;
        this.trigger = this.querySelector("[data-sticky-video-trigger]");
        this.panel = this.querySelector("[data-sticky-video-panel]");
        this.collapsedVideo = this.querySelector(".home-sticky-video__video--collapsed");
        this.expandedVideo = this.querySelector(".home-sticky-video__video--expanded");
        this.closeButton = this.querySelector("[data-sticky-video-close]");
        this.soundButton = this.querySelector("[data-sticky-video-sound]");
        this.shareButton = this.querySelector("[data-sticky-video-share]");
        this.favoriteButton = this.querySelector("[data-sticky-video-favorite]");
        this.cta = this.querySelector("[data-sticky-video-cta]");
        this.feedback = this.querySelector("[data-sticky-video-feedback]");
        this.saveFavorite = this.dataset.saveFavorite === "true";

        this.trigger?.addEventListener("click", this.onTriggerClick);
        this.trigger?.addEventListener("keydown", this.onTriggerKeydown);
        this.closeButton?.addEventListener("click", this.onCloseClick);
        this.soundButton?.addEventListener("click", this.onSoundClick);
        this.shareButton?.addEventListener("click", this.onShareClick);
        this.favoriteButton?.addEventListener("click", this.onFavoriteClick);
        this.cta?.addEventListener("click", this.stopEvent);

        this.querySelectorAll(".home-sticky-video__control").forEach((button) => {
          button.addEventListener("click", this.stopEvent);
        });

        this.setMuted(true);
        this.restoreFavorite();
        this.playVideo(this.collapsedVideo);
        this.initialized = true;
      }

      disconnectedCallback() {
        this.trigger?.removeEventListener("click", this.onTriggerClick);
        this.trigger?.removeEventListener("keydown", this.onTriggerKeydown);
        this.closeButton?.removeEventListener("click", this.onCloseClick);
        this.soundButton?.removeEventListener("click", this.onSoundClick);
        this.shareButton?.removeEventListener("click", this.onShareClick);
        this.favoriteButton?.removeEventListener("click", this.onFavoriteClick);
        this.cta?.removeEventListener("click", this.stopEvent);

        this.querySelectorAll(".home-sticky-video__control").forEach((button) => {
          button.removeEventListener("click", this.stopEvent);
        });

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
        this.panel.hidden = false;
        this.trigger?.setAttribute("aria-expanded", "true");
        this.setMuted(true);
        this.pauseVideo(this.collapsedVideo);
        this.playVideo(this.expandedVideo);
        this.closeButton?.focus({ preventScroll: true });
      }

      close(event) {
        event?.preventDefault();
        event?.stopPropagation();
        if (!this.isExpanded) return;

        this.isExpanded = false;
        this.dataset.expanded = "false";
        this.trigger?.setAttribute("aria-expanded", "false");
        this.setMuted(true);
        this.pauseVideo(this.expandedVideo);
        this.playVideo(this.collapsedVideo);

        if (this.panel) {
          this.panel.hidden = true;
        }

        this.trigger?.focus({ preventScroll: true });
      }

      toggleSound(event) {
        event.preventDefault();
        event.stopPropagation();
        if (!this.soundButton || !this.expandedVideo) return;

        const shouldUnmute = this.expandedVideo.muted;
        this.setMuted(!shouldUnmute);
        this.playVideo(this.expandedVideo);
      }

      setMuted(isMuted) {
        [this.collapsedVideo, this.expandedVideo].forEach((video) => {
          if (!video) return;
          video.muted = true;
          video.defaultMuted = true;
        });

        if (this.expandedVideo) {
          this.expandedVideo.muted = isMuted;
          this.expandedVideo.defaultMuted = isMuted;
        }

        if (this.collapsedVideo) {
          this.collapsedVideo.muted = true;
          this.collapsedVideo.defaultMuted = true;
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

      playVideo(video) {
        if (!video) return;

        const playPromise = video.play();
        if (playPromise?.catch) {
          playPromise.catch(() => {});
        }
      }

      pauseVideo(video) {
        if (!video) return;
        video.pause();
      }

      stopPropagation(event) {
        event.stopPropagation();
      }
    }
  );
}
