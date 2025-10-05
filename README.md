# FediTag
FediTag uses JavaScript to embed a feed of Mastodon posts from one account using a particular hashtag on a website or page.

As seen on [enikofox.com/blockgame/](https://enikofox.com/blockgame/).

# Features

- Display up to 40 posts (Mastodon API limit) in a feed
- Posts load on demand, 5 at a time, to reduce load on instances
- Supports images, gifs, video, audio, and "unknown" type media attachments
- Supports polls
- Supports custom emojis
- Lightbox galleries for images (see below)
- Automatic removal of trailing hashtags

# How to use

Download the JavaScript, css, and svg files. Link the JavaScript and css from your page's head element:

```html
<link rel="stylesheet" href="feditag.css">
<script src="feditag.js"></script> 
```

Add a fedi-tag element to your page:

```html
<fedi-tag host="mastodon.social" account="1" tag="FilmPhotography">
    <p><em>This feature requires JavaScript to be enabled.</em></p>
</fedi-tag>
```

If you need to look up the account ID, you can do so via `https://host/api/v1/accounts/lookup?acct=username` on your local instance.

# Lightbox image galleries

I used [SimpleLightbox](https://github.com/dbrekalo/simpleLightbox) (with minor aesthetic tweaks) for lightbox image galleries. If you use it, things will work out of the box. If you don't use it, thumbnails will just link normally to the full-size images. If you want to use a different lightbox solution you'll want to modify the `renderPost` function.

