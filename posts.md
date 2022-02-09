---
layout: default
title: BrainTool Posts and Case Studies
description: Control your browser with BrainTool, don't let it control you. Free and private. Download now!
audience: nonuser
---
<ul>
    {% for post in site.posts %}
        <a href="{{ post.url }}">{{ post.excerpt }}</a>
        <a href="{{ post.url }}"><b>...</b></a><br/><br/>
    {% endfor %}
</ul>
