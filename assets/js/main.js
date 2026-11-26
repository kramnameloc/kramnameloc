(function () {
  "use strict";

  function sitePath(path) {
    var base = (window.siteConfig && window.siteConfig.baseUrl) || "";
    return "" + base + path;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function formatDate(value) {
    var date = new Date(value + "T00:00:00");
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  function initThemeToggle() {
    var button = document.getElementById("theme-toggle");
    if (!button) return;

    var systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    function isDark() {
      var override = document.documentElement.dataset.theme;
      return override ? override === "dark" : systemTheme.matches;
    }
    function syncButton() {
      button.setAttribute("aria-pressed", String(isDark()));
    }
    button.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("theme", next);
      } catch (error) {}
      syncButton();
    });
    systemTheme.addEventListener("change", syncButton);
    syncButton();
    button.hidden = false;
  }

  function initPostToc() {
    var toc = document.querySelector("[data-post-toc]");
    if (!toc) return;

    var tocList = toc.querySelector("[data-post-toc-list]");
    var content = document.querySelector(".post-content");
    if (!tocList || !content) return;

    var headings = Array.prototype.slice.call(content.querySelectorAll("h2, h3"));
    if (headings.length < 3) {
      toc.hidden = true;
      return;
    }

    var used = new Set();
    headings.forEach(function (heading) {
      if (!heading.id) {
        var base = slugify(heading.textContent) || "section";
        var candidate = base;
        var count = 2;
        while (used.has(candidate) || document.getElementById(candidate)) {
          candidate = base + "-" + count;
          count += 1;
        }
        heading.id = candidate;
        used.add(candidate);
        return;
      }

      used.add(heading.id);
    });

    tocList.innerHTML = headings
      .map(function (heading) {
        var levelClass = heading.tagName.toLowerCase() === "h3" ? "toc-item toc-item-sub" : "toc-item";
        return (
          '<li class="' +
          levelClass +
          '"><a href="#' +
          escapeHtml(heading.id) +
          '">' +
          escapeHtml(heading.textContent.trim()) +
          "</a></li>"
        );
      })
      .join("");

    toc.hidden = false;
  }

  function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value);
    }

    return new Promise(function (resolve, reject) {
      try {
        var input = document.createElement("textarea");
        input.value = value;
        input.setAttribute("readonly", "");
        input.style.position = "absolute";
        input.style.left = "-9999px";
        document.body.appendChild(input);
        input.select();
        var success = document.execCommand("copy");
        document.body.removeChild(input);
        if (success) {
          resolve();
          return;
        }
        reject(new Error("Copy command failed"));
      } catch (error) {
        reject(error);
      }
    });
  }

  function initShareTools() {
    var sections = Array.prototype.slice.call(document.querySelectorAll("[data-share-tools]"));
    if (sections.length === 0) return;

    sections.forEach(function (section) {
      var nativeButton = section.querySelector("[data-share-native]");
      var copyButton = section.querySelector("[data-copy-link]");
      var status = section.querySelector("[data-copy-status]");
      var shareUrl = (copyButton && copyButton.getAttribute("data-share-url")) || window.location.href;
      var shareTitle = document.querySelector(".post-header h1")
        ? document.querySelector(".post-header h1").textContent.trim()
        : document.title;

      function setStatus(message) {
        if (status) status.textContent = message;
      }

      if (nativeButton) {
        if (!navigator.share) {
          nativeButton.hidden = true;
        } else {
          nativeButton.hidden = false;
          nativeButton.addEventListener("click", function () {
            navigator
              .share({
                title: shareTitle,
                url: shareUrl
              })
              .catch(function () {
                return;
              });
          });
        }
      }

      if (copyButton) {
        copyButton.hidden = false;
        copyButton.addEventListener("click", function () {
          copyText(shareUrl)
            .then(function () {
              setStatus("Link copied to clipboard.");
            })
            .catch(function () {
              setStatus("Unable to copy automatically. Please copy the URL manually.");
            });
        });
      }
    });
  }

  function renderResult(post) {
    var summary = post.summary ? '<p class="excerpt">' + escapeHtml(post.summary) + '</p>' : '';
    return '<article class="entry">' +
      '<p class="entry-meta"><time datetime="' + escapeHtml(post.date) + '">' + escapeHtml(formatDate(post.date)) +
      '</time><span aria-hidden="true">·</span>' + escapeHtml(String(post.readTime || 1)) + ' min read</p>' +
      '<h3><a href="' + escapeHtml(post.url) + '">' + escapeHtml(post.title) + '</a></h3>' +
      summary + '</article>';
  }

  async function initDiscovery() {
    var root = document.querySelector("[data-discovery-root]");
    if (!root) return;

    var form = root.querySelector("[data-discovery-form]");
    var status = root.querySelector("[data-discovery-status]");
    var defaults = root.querySelector("[data-discovery-default]");
    var results = root.querySelector("[data-discovery-results]");
    var archive = root.querySelector("[data-view-archive]");
    var heading = root.querySelector("#recent-title");
    var clear = root.querySelector("[data-clear-filters]");
    var limit = Number(root.dataset.discoveryLimit) || Infinity;
    var params = new URLSearchParams(window.location.search);
    var posts;
    try {
      var response = await fetch(sitePath("/search.json"));
      if (!response.ok) throw new Error("Search index unavailable");
      posts = await response.json();
    } catch (error) {
      status.textContent = "Search is unavailable. You can still browse the journal entries.";
      return;
    }

    ["q", "tag", "year"].forEach(function (key) {
      var value = params.get(key) || "";
      var control = form.elements[key];
      // Preserve shared links even when a topic or year is no longer in the index.
      if (value && control.tagName === "SELECT" && !Array.from(control.options).some(function (option) { return option.value === value; })) {
        control.add(new Option(value, value));
      }
      control.value = value;
    });

    function filterPosts() {
      var query = form.elements.q.value.trim();
      var tag = form.elements.tag.value;
      var year = form.elements.year.value;
      var active = Boolean(query || tag || year);
      var url = new URL(window.location.href);
      Object.entries({q: query, tag: tag, year: year}).forEach(function (entry) {
        if (entry[1]) url.searchParams.set(entry[0], entry[1]);
        else url.searchParams.delete(entry[0]);
      });
      if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
      if (archive) archive.href = sitePath("/archive/") + url.search;
      if (heading) heading.textContent = active ? "Search results" : "Recent writing";
      defaults.hidden = active;
      results.hidden = !active;
      clear.hidden = !active;
      if (!active) {
        results.replaceChildren();
        status.textContent = "";
        return;
      }

      var needle = query.toLowerCase();
      var matches = posts.filter(function (post) {
        var tags = post.tags || [];
        var text = [post.title, post.summary].concat(tags).join(" ").toLowerCase();
        return text.includes(needle) && (!tag || tags.includes(tag)) && (!year || post.year === year);
      });
      var visible = matches.slice(0, limit);
      results.innerHTML = visible.map(renderResult).join("");
      if (matches.length === 0) status.textContent = "No posts match these filters.";
      else if (visible.length < matches.length) status.textContent = "Showing " + visible.length + " of " + matches.length + " matching posts.";
      else status.textContent = matches.length + (matches.length === 1 ? " matching post." : " matching posts.");
    }

    form.addEventListener("input", filterPosts);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      filterPosts();
    });
    clear.addEventListener("click", function () {
      form.reset();
      filterPosts();
      form.elements.q.focus();
    });
    filterPosts();
    form.hidden = false;
  }

  function init() {
    initThemeToggle();
    initPostToc();
    initShareTools();
    initDiscovery();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
