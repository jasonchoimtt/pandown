Pandown
=======

A simple Electron app that watches Markdown files and invokes `pandoc` to render
an HTML preview.

Also uses some (not so perfect) virtual-dom thing-o'-magic to incrementally
update MathJax equations.

Why?
----

`markdown-preview-plus` in Atom is great, but I am a vim user. That's why.

And I wanted to learn Electron.

Building
--------

I only have OS X build set up.

```sh
git clone https://github.com/jasonchoimtt/pandown
cd pandown
npm install

# Build Pandown.app
make dist

# This will symlink the compiled app to ~/Applications/Pandown.app
make link-darwin-x64
# Alternatively you can just copy the built app there
```
