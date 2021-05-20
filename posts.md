---
layout: default
title: Posts and Case Studies
audience: nonuser
---
<ul>
    {% for post in site.posts %}
        <a href="{{ post.url }}">{{ post.excerpt }}</a>
        <a href="{{ post.url }}"><b>...</b></a><br/><br/>
    {% endfor %}
</ul>
