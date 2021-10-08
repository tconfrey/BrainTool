---
layout: default
title: About BrainTool. Posts and Case Studies
description: Control your browser with BrainTool, don't let it control you. Free and private. Download now!
audience: nonuser
---
# About BrainTool
In one way or other I've been working on BrainTool my whole life. It's an evolution of how I organize and manage my own [information space](https://informationspace.net). After a short career as a software developer and longer one as an architect and engineering manager I recognized that the time was right to build it as a product for general use. 

These days knowledge workers spend most of their time in a browser. Today's browsers are amazing tools, but they don't provide support for organizing and managing all of your online stuff. BrainTool provides that support. 

The posts and essays below give more details and background.

-- Tony
<hr/>
<ul>
    {% for post in site.posts %}
        <a href="{{ post.url }}">{{ post.excerpt }}</a>
        <a href="{{ post.url }}"><b>...</b></a><br/><br/>
    {% endfor %}
</ul>
