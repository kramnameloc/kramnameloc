---
layout: default
title: Topics
permalink: /topics/
---
{% assign sorted_tags = site.tags | sort %}

<header class="masthead">
  <h1>Topics<span>.</span></h1>
  <p>Explore the journal by subject. Each collection starts with its most recent entries.</p>
</header>

<section class="topics-grid" aria-label="Topic links">
  {% for tag_item in sorted_tags %}
    {% assign tag_name = tag_item[0] %}
    {% assign posts = tag_item[1] | sort: 'date' | reverse %}
    <article id="topic-{{ tag_name | slugify }}" class="topic-card">
      <header>
        <h2>
          <a href="{{ '/archive/' | relative_url }}?tag={{ tag_name | uri_escape }}">{{ site.data.topic_names[tag_name] | default: tag_name | replace: '-', ' ' }}</a>
        </h2>
        <p>{{ posts.size }} post{% if posts.size != 1 %}s{% endif %}</p>
      </header>
      <ul class="topic-list">
        {% for post in posts limit: 4 %}
          <li>
            <a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
            <span>{{ post.date | date: "%Y" }}</span>
          </li>
        {% endfor %}
      </ul>
    </article>
  {% endfor %}
</section>
