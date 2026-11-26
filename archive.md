---
layout: default
title: Archive
permalink: /archive/
---
{% assign posts_by_year = site.posts | group_by_exp: "post", "post.date | date: '%Y'" %}
<header class="masthead">
  <h1>Archive<span>.</span></h1>
  <p>{{ site.posts.size }} entries, from {{ site.posts.last.date | date: '%Y' }} to {{ site.posts.first.date | date: '%Y' }}. Browse the journal by year or find a particular post.</p>
</header>

<section aria-label="Archive entries" data-discovery-root>
  <div class="section-head">
    <h2>All writing</h2>
    {% include filters.html %}
  </div>
  <div data-discovery-default>
    {% for year in posts_by_year %}
      <details class="archive-year" id="year-{{ year.name }}" {% if forloop.first %}open{% endif %}>
        <summary><span>{{ year.name }}</span><small>{{ year.items.size }} {% if year.items.size == 1 %}entry{% else %}entries{% endif %}</small>{% include icon.html name='chevron' %}</summary>
        <ul>
          {% for post in year.items %}
            <li>
              <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%b %-d" }}</time>
              <a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
            </li>
          {% endfor %}
        </ul>
      </details>
    {% endfor %}
  </div>
  <div class="entries" data-discovery-results hidden></div>
  <div class="search-feedback">
    <p class="search-status" data-discovery-status role="status"></p>
    <button type="button" data-clear-filters hidden>Clear filters</button>
  </div>
</section>
