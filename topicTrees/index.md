---
title: Public Topic Trees
layout: default
tagline: A set of curated web resouorces
description: BrainTool can save and load individual topic trees, allowing the exchange of bookmarks, research and other information. This is a list of public topic trees
audience: user
---

# BrainTool Topic Trees
BrainTool can save and load individual topic trees, allowing the exchange of packets of bookmarks, research and other information. This is a bare bones demonstration of the concept that could over time grow to house a curated list of best-in-class resources and starter notes on any given topic. Click to download a .org file, then import it into your BrainTool to add it to your personal topic map.

{% for org in site.static_files %}
    {% if org.path contains 'topicTrees' %}
<h3>
<a href="{{ site.baseurl }}{{ org.path }}">{{ org.name }}</a>
</h3>
    {% endif %}
{% endfor %}
