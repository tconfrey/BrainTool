---
layout: default
title: Posts and Case Studies
---
<ul>
  {% for post in site.posts %}
    <li>
      <a href="{{ post.url }}">{{ post.title }}</a>
      {{ post.excerpt }}
      <br/><a href="{{ post.url }}"><b>...</b></a>
    </li>
  {% endfor %}
</ul>
