/**
 * @typedef Emoji
 * @property {string} shortcode
 * @property {string} url
 */

/**
 * @typedef PollOption
 * @property {string} title
 * @property {number} votes_count
 */

/**
 * @typedef Poll
 * @property {boolean} expired
 * @property {PollOption[]} options
 * @property {number} votes_count
 */

/**
 * @typedef MediaAttachmentMetaSmall
 * @property {number} height
 * @property {number} width
 */

/**
 * @typedef MediaAttachmentMeta
 * @property {MediaAttachmentMetaSmall} small
 */

/**
 * @typedef MediaAttachment
 * @property {string} description
 * @property {MediaAttachmentMeta} meta
 * @property {string} preview_url
 * @property {string} type
 * @property {string} url
 */

/**
 * @typedef Post
 * @property {string} content
 * @property {string} created_at
 * @property {Emoji[]} emojis
 * @property {MediaAttachment[]} media_attachments
 * @property {Poll} poll
 * @property {string} url
 */

class FediTag extends HTMLElement {
    galleryIndex = 0;
    postsLoaded = 0;
    /**
     * 40 is the max according to mastodon's api.
     * @see {@link https://docs.joinmastodon.org/methods/accounts/#query-parameters-1}
     */
    limit = 40; //
    feedLoaded = false;
    /** @type {Post[]} */
    posts = [];

    connectedCallback() {
        this.host = this.getAttribute("host");
        this.accountID = this.getAttribute("account");
        this.fediTagName = this.getAttribute("tag");
        this.fediTagContainer = Object.assign(document.createElement("div"), {
            id: "feditag-container",
        });
        this.fediTagPosts = Object.assign(document.createElement("div"), {
            id: "feditag-posts",
            innerHTML: "<p><em>Loading posts...</em></p>"
        });
        this.fediTagContainer.appendChild(this.fediTagPosts);

        setTimeout(
            () =>
                this.respondToVisibility(
                    this.fediTagContainer,
                    this.loadPosts.bind(this),
                ),
            0,
        );
    }

    /** @param {HTMLDivElement} contents */
    removeTrailingHashtags(contents) {
        let para = contents.lastChild;
        let isOnlyHashtags = true;

        for (const node of para.childNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.nodeName !== "A" || node.rel !== "tag") {
                    isOnlyHashtags = false;
                    break;
                }
            }
            else {
                if (node.textContent === null || node.textContent.trim().length === 0) {
                    continue;
                }
                isOnlyHashtags = false;
                break;
            }
        }

        if (!isOnlyHashtags) {
            return;
        }

        contents.removeChild(para);
    }

    /** @param {Post} post */
    renderPost(post) {
        // format contents and process emojis
        let contents = document.createElement("div");
        let contentText = post.content;

        if (Array.isArray(post.emojis)) {
            for (let i = 0; i < post.emojis.length; i++) {
                contentText = contentText.replace(`:${post.emojis[i].shortcode}:`,
                    `<img src="${post.emojis[i].url}" class="feditag-emoji">`);
            }
        }

        contents.innerHTML = contentText;

        // remove trailing hashtags (if any)
        this.removeTrailingHashtags(contents);

        // format date
        const dateStr = new Date(post.created_at).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

        const dateEle = Object.assign(document.createElement("p"), {
            innerHTML: `
                <span class="feditag-date">
                    <a href="${post.url}" target="_blank" class="feditag-post-link">
                        <img src="external-link.svg" class="feditag-post-link">
                    </a>
                    <em>${dateStr}</em>
                </span>
            `
        });

        contents.insertBefore(dateEle, contents.firstChild);

        // handle polls
        let poll = post.poll;
        if (poll) {
            for (let i = 0; i < poll.options.length; i++) {
                const opt = poll.options[i];
                let percent = opt.votes_count / poll.votes_count;
                let percentText = `${Math.floor(percent * 100 + 0.5)}%`;

                let optEle = document.createElement("div");
                optEle.classList.add("feditag-poll");
                optEle.innerHTML = `
                    <p>
                        <span class="feditag-poll-percent">${percentText}</span>
                        <span class="feditag-poll-text">${opt.title}</span>
                    </p>
                    <div class="feditag-poll-bar" style="width: ${percentText}"></div>
                `;

                contents.appendChild(optEle);
            }

            const voteLink = poll.expired
                ? "Poll closed"
                : `<a href="${post.url}">Vote on Mastodon</a>`;
            const vote = Object.assign(document.createElement("p"), {
                innerHTML: `<em>${poll.votes_count} votes | ${voteLink}</em>`,
            });
            contents.appendChild(vote);
        }

        // handle media attachments
        let attachments = post.media_attachments;
        let galleryName = null;

        if (Array.isArray(attachments) && attachments.length > 0) {
            let gallery = document.createElement("div");
            gallery.classList.add('feditag-gallery');
            gallery.classList.add(galleryName = `feditag-gallery-n${this.galleryIndex}`);
            gallery.id = galleryName;
            this.galleryIndex++;

            // images, gifs, and videos (image gallery items)
            for (let i = 0; i < attachments.length; i++) {
                let media = attachments[i];

                if (media.type === "image" || media.type === "gifv" || media.type === "video") {
                    let mediaUrl = media.url;
                    let previewUrl = media.preview_url;
                    let previewSize = media.meta.small;
                    let altText = media.description;

                    let mediaHtml = null;
                    if (media.type === "image") {
                        mediaHtml = `
                            <div class="feditag-gallery-item">
                                <a href="${mediaUrl}" title="${altText}">
                                    <img src="${previewUrl}" alt="${altText}" width="${previewSize.width}" height="${previewSize.height}">
                                </a>
                            </div>
                        `;
                    }
                    else if (media.type === "gifv") {
                        mediaHtml = `
                            <div class="feditag-gallery-video">
                                <video width="${previewSize.width}" height="${previewSize.height}" controls loop autoplay>
                                    <source src="${mediaUrl}">
                                    Your browser does not support the video element.
                                </video>
                            </div>
                        `;
                    }
                    else {
                        mediaHtml = `
                            <div class="feditag-gallery-video">
                                <video width="${previewSize.width}" height="${previewSize.height}" controls>
                                    <source src="${mediaUrl}">
                                    Your browser does not support the video element.
                                </video>
                            </div>
                        `;
                    }

                    if (mediaHtml === null || mediaHtml === "") {
                        continue;
                    }

                    const div = Object.assign(document.createElement("div"), {
                        innerHTML: mediaHtml.trim()
                    });

                    gallery.appendChild(div.firstChild);
                }
            }

            contents.appendChild(gallery);

            // audio and unknown (non-image gallery items)
            for (let i = 0; i < attachments.length; i++) {
                let media = attachments[i];

                if (media.type === "image" || media.type === "gifv" || media.type === "video") {
                    continue;
                }

                let mediaHtml = null;
                if (media.type === "audio") {
                    mediaHtml = `
                        <p><audio controls>
                            <source src="${media.url}">
                            Your browser does not support the audio element.
                        </audio></p>
                    `;
                }
                else {
                    mediaHtml = `
                        <p>Click to open media attachment: <a href="${media.url}">${media.url}</a></p>
                    `;
                }

                if (mediaHtml === null || mediaHtml === "") {
                    continue;
                }

                const div = Object.assign(document.createElement("div"), {
                    innerHTML: mediaHtml.trim()
                });

                gallery.appendChild(div.firstChild);
            }
        }

        // create container and add contents
        let div = document.createElement("div");
        div.classList.add('feditag-post');
        div.appendChild(contents);

        this.fediTagPosts.appendChild(div);

        // instantiate lightbox
        if (galleryName && typeof SimpleLightbox !== 'undefined') {
            new SimpleLightbox({ elements: `.${galleryName} a` });
        }
    }

    renderPosts() {
        let isDone = false;

        for (let i = 0; i < 5; i++) {
            this.renderPost(this.posts[this.postsLoaded]);

            this.postsLoaded++;
            if (this.postsLoaded >= this.posts.length) {
                isDone = true;
                break;
            }
        }

        if (!isDone) {
            let div = document.createElement("div");
            div.classList.add('feditag-post');
            div.innerHTML = "<p>Fetching more posts...</p>";

            this.fediTagPosts.appendChild(div);

            setTimeout(() => {
                let postLoaderActivated = false;

                this.respondToVisibility(div, () => {
                    if (postLoaderActivated) {
                        return;
                    }
                    postLoaderActivated = true;

                    this.fediTagPosts.removeChild(div);

                    this.renderPosts();
                });
            }, 500);
        }
    }

    loadPosts() {
        if (this.feedLoaded) return;

        fetch(
            `https://${this.host}/api/v1/accounts/${this.accountID}/statuses?${new URLSearchParams(
                {
                    limit: `${this.limit}`,
                    tagged: `${this.fediTagName}`,
                },
            )}`
        )
        .then((response) => response.json())
        .then((data) => {
            if (Array.isArray(data) && data.length > 0) {
                this.fediTagPosts.innerHTML = "";
                this.posts = data;
                this.renderPosts(data);
            }
            else {
                this.fediTagPosts.innerHTML = "<p><em>No posts found.</em></p>";
            }

            this.feedLoaded = true;
        });
    }

    /**
     * @param {HTMLElement} element
     * @param {() => void} callback
     */
    respondToVisibility(element, callback) {
        var options = {
            root: null,
        };

        var observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.intersectionRatio > 0) {
                    callback();
                }
            });
        }, options);

        observer.observe(element);
    }
}

customElements.define("fedi-tag", FediTag);
