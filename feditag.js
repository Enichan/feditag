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
    /** Posts are loaded in chunks, this defines the size of those chunks. */
    chunkSize = 5;
    galleryIndex = 0;
    postsLoaded = 0;
    /**
     * 40 is the max according to mastodon's api.
     * @see {@link https://docs.joinmastodon.org/methods/accounts/#query-parameters-1}
     */
    limit = 40;
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
        const para = contents.lastChild;
        const isOnlyHashtags = [...para.childNodes].every((node) =>
            node.nodeType === Node.ELEMENT_NODE
                ? node.nodeName === "A" && node.rel === "tag"
                : (node.textContent ?? "").trim().length === 0,
        );

        if (isOnlyHashtags) {
            contents.removeChild(para);
        }
    }

    /** @param {Post} post */
    renderPost(post) {
        // format contents and process emojis
        const contents = document.createElement("div");
        const contentText = Array.isArray(post.emojis)
            ? post.emojis.reduce(
                  (contentText, emoji) =>
                      contentText.replace(
                          `:${emoji.shortcode}:`,
                          `<img src="${emoji.url}" class="feditag-emoji">`,
                      ),
                  post.content,
              )
            : post.content;

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
            poll.options.forEach((opt) => {
                const percent = opt.votes_count / poll.votes_count;
                const percentText = `${Math.floor(percent * 100 + 0.5)}%`;
                const optEle = Object.assign(document.createElement("div"), {
                    className: "feditag-poll",
                    innerHTML: `
                        <p>
                            <span class="feditag-poll-percent">${percentText}</span>
                            <span class="feditag-poll-text">${opt.title}</span>
                        </p>
                        <div class="feditag-poll-bar" style="width: ${percentText}"></div>
                    `
                });

                contents.appendChild(optEle);
            });

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
            attachments.forEach(
                ({
                    description,
                    meta: { small: { height, width } },
                    preview_url,
                    type,
                    url,
                }) => {
                    if (
                        type === "image" ||
                        type === "gifv" ||
                        type === "video"
                    ) {
                        let mediaHtml = "";
                        if (type === "image") {
                            mediaHtml = `
                            <div class="feditag-gallery-item">
                                <a href="${url}" title="${description}">
                                    <img src="${preview_url}" alt="${description}" width="${width}" height="${height}">
                                </a>
                            </div>
                        `;
                        } else if (type === "gifv") {
                            mediaHtml = `
                            <div class="feditag-gallery-video">
                                <video width="${width}" height="${height}" controls loop autoplay>
                                    <source src="${url}">
                                    Your browser does not support the video element.
                                </video>
                            </div>
                        `;
                        } else {
                            mediaHtml = `
                            <div class="feditag-gallery-video">
                                <video width="${width}" height="${height}" controls>
                                    <source src="${url}">
                                    Your browser does not support the video element.
                                </video>
                            </div>
                        `;
                        }

                        const trimmedMediaHtml = mediaHtml.trim();

                        if (trimmedMediaHtml !== "") {
                            const div = Object.assign(
                                document.createElement("div"),
                                { innerHTML: trimmedMediaHtml },
                            );

                            gallery.appendChild(div.firstChild);
                        }
                    }
                },
            );

            contents.appendChild(gallery);

            // audio and unknown (non-image gallery items)
            attachments.forEach(({ type, url }) => {
                if (type !== "image" && type !== "gifv" && type !== "video") {
                    let mediaHtml = "";
                    if (type === "audio") {
                        mediaHtml = `
                        <p><audio controls>
                            <source src="${url}">
                            Your browser does not support the audio element.
                        </audio></p>
                    `;
                    } else {
                        mediaHtml = `
                        <p>Click to open media attachment: <a href="${url}">${url}</a></p>
                    `;
                    }

                    const trimmedMediaHtml = mediaHtml.trim();

                    if (trimmedMediaHtml !== "") {
                        const div = Object.assign(
                            document.createElement("div"),
                            { innerHTML: trimmedMediaHtml },
                        );

                        gallery.appendChild(div.firstChild);
                    }
                }
            });
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
        const chunk = this.posts.slice(
            this.postsLoaded,
            (this.postsLoaded += this.chunkSize),
        );

        chunk.forEach(post => this.renderPost(post));

        if (chunk.length > 0) {
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
