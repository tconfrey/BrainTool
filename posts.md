---
layout: default
title: BrainTool Posts and Case Studies
description: Control your browser with BrainTool, don't let it control you. Free and private. Download now!
audience: nonuser
---
<ul>
    {% for post in site.posts %}
        <a href="{{ post.url }}"><h1>{{ post.title }}</h1></a>
        <table><tr><td style="border:none">
        {% if post.content contains "<!--start-->" %}
            {% assign extract = post.content | split: "<!--start-->" | last | split: "<!--end-->" | first | strip_html %}
            {{ extract }}
        {% else %}
            {{ post.excerpt | strip_html }}
        {% endif %}
        </td>
        {% if post.image %}
            <td style="width: 50%; border: none">
            <img src="{{ post.image }}"/>
            </td>
        {% endif %}
        </tr>
        </table>
        <a href="{{ post.url }}"><i>More </i><b>...</b></a><br/><br/>
        <hr/>
    {% endfor %}
</ul>



        {% comment %}
    {% if post.image %}
    {% endif %}
    {% endcomment %}
