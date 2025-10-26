class FediTag extends HTMLElement {
    constructor() {
        super();

        this.galleryIndex = 0;
        this.postsLoaded = 0;
        this.limit = 40; // 40 is the max according to mastodon's api

        this.feedLoaded = false;
    }

    connectedCallback() {
        this.host = this.getAttribute("host");
        this.accountID = this.getAttribute("account");
        this.fediTagName = this.getAttribute("tag");

        let _this = this;
        setTimeout(() => {
            _this.innerHTML = `
                <div id="feditag-container">
                    <div id="feditag-posts">
                        <p><em>Loading posts...</em></p>
                    </div>
                </div>
            `;

            const posts = document.getElementById("feditag-container");
            _this.respondToVisibility(posts, _this.loadPosts.bind(_this));
        }, 0);
    }

    escapeHtml(unsafe) {
        return (unsafe || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    removeTrailingHashtags(contents) {
        let para = contents.lastChild;
        let isOnlyHashtags = true;

        for (const node of para.childNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.nodeName != "A" || node.rel != "tag") {
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

    renderPost(post) {
        // format contents and process emojis
        let contents = document.createElement("div");
        let contentText = post.content;

        if (Array.isArray(post["emojis"])) {
            for (let i = 0; i < post.emojis.length; i++) {
                contentText = contentText.replace(":" + post.emojis[i].shortcode + ":", 
                    `<img src="${post.emojis[i].url}" class="feditag-emoji">`);
            }
        }

        contents.innerHTML = contentText;

        // remove trailing hashtags (if any)
        this.removeTrailingHashtags(contents);

        // format date
        let date = new Date(post["created_at"]);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        let dateStr = date.toLocaleDateString('en-US', options);

        let dateEle = document.createElement("p");
        dateEle.innerHTML = `
            <span class="feditag-date"><a href="${post.url}" target="_blank" class="feditag-post-link"><img src="external-link.svg" class="feditag-post-link"></a>
            <em>${dateStr}</em></span>
        `;

        contents.insertBefore(dateEle, contents.firstChild);

        // handle polls
        let poll = post["poll"];
        if (poll) {
            for (let i = 0; i < poll.options.length; i++) {
                const opt = poll.options[i];
                let percent = poll.votes_count == 0 ? 0 : opt.votes_count / poll.votes_count;
                let percentText = Math.floor(percent * 100 + 0.5) + "%";

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

            let vote = document.createElement("p");
            if (poll.expired) {
                vote.innerHTML = `<em>${poll.votes_count} votes | Poll closed</em>`;
            }
            else {
                vote.innerHTML = `<em>${poll.votes_count} votes | <a href="${post.url}" target="_blank">Vote on Mastodon</a></em>`;
            }
            contents.appendChild(vote);
        }

        // handle media attachments
        let attachments = post["media_attachments"];
        let galleryName = null;

        if (Array.isArray(attachments) && attachments.length > 0) {
            let gallery = document.createElement("div");
            gallery.classList.add('feditag-gallery');
            gallery.classList.add(galleryName = 'feditag-gallery-n' + this.galleryIndex);
            gallery.id = galleryName;
            this.galleryIndex++;

            // images, gifs, and videos (image gallery items)
            for (let i = 0; i < attachments.length; i++) {
                let media = attachments[i];

                if (media.type == "image" || media.type == "gifv" || media.type == "video") {
                    let mediaUrl = media["url"];
                    let previewUrl = media["preview_url"];
                    let previewSize = media["meta"]["small"];
                    let altText = this.escapeHtml(media["description"]);

                    let mediaHtml = null;
                    if (media.type == "image") {
                        mediaHtml = `
                            <div class="feditag-gallery-item">
                                <a href="${mediaUrl}" title="${altText}">
                                    <img src="${previewUrl}" alt="${altText}" width="${previewSize.width}" height="${previewSize.height}">
                                </a>
                            </div>
                        `;
                    }
                    else if (media.type == "gifv") {
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
                    
                    let div = document.createElement("div");
                    div.innerHTML = mediaHtml.trim();

                    gallery.appendChild(div.firstChild);
                }
            }

            contents.appendChild(gallery);

            // audio and unknown (non-image gallery items)
            for (let i = 0; i < attachments.length; i++) {
                let media = attachments[i];

                if (media.type == "image" || media.type == "gifv" || media.type == "video") {
                    continue;
                }

                let mediaHtml = null;
                if (media.type == "audio") {
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

                let div = document.createElement("div");
                div.innerHTML = mediaHtml.trim();

                gallery.appendChild(div.firstChild);
            }
        }

        // create container and add contents
        let div = document.createElement("div");
        div.classList.add('feditag-post');
        div.appendChild(contents);

        document.getElementById("feditag-posts").appendChild(div);

        // instantiate lightbox
        if (galleryName && typeof SimpleLightbox !== 'undefined') {
            new SimpleLightbox({elements: '.' + galleryName + ' a'});
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

            document.getElementById("feditag-posts").appendChild(div);

            let _this = this;

            setTimeout(() => {
                let postLoaderActivated = false;

                _this.respondToVisibility(div, () => {
                    if (postLoaderActivated) {
                        return;
                    }
                    postLoaderActivated = true;

                    document.getElementById("feditag-posts").removeChild(div);

                    _this.renderPosts();
                });
            }, 500);
        }
    }

    loadPosts() {
        if (this.feedLoaded) return;

        let _this = this;

        fetch(
            "https://" + this.host + "/api/v1/accounts/" + this.accountID + "/statuses?tagged=" + this.fediTagName + "&limit=" + this.limit
        )
        .then((response) => response.json())
        .then((data) => {
            if (Array.isArray(data) && data.length > 0) {
                document.getElementById("feditag-posts").innerHTML = "";
                _this.posts = data;
                _this.renderPosts(data);
            }
            else {
                document.getElementById("feditag-posts").innerHTML = "<p><em>No posts found.</em></p>";
            }

            _this.feedLoaded = true;
        });
    }

    respondToVisibility(element, callback) {
        var options = {
            root: null,
        };

        var observer = new IntersectionObserver((entries, observer) => {
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
