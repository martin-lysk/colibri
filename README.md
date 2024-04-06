# Colibri - Collaborative Markdown Editing

Colibri, derived from "Consensus Libri," is a React-based SPA designed for collaborative Markdown editing. With its seamless integration with GitHub and a pure Git server backend, Colibri empowers users to collaborate on Markdown documents in real-time.

## Features:
- **Real-time Collaboration:** Utilize braid.org's Sync9 CRDT for seamless real-time changes.
- **Git Protocol Integration:** Communicate directly with Git's smart protocol for efficient collaboration.
- **WYSIWYG Editing:** Edit Markdown documents using QuillJS, providing a Google Docs-like experience.
- **Annotation and Discussion:** Annotate passages, discuss sections, and collaborate in real-time.
- **Version Control:** Track changes and annotations within a separate Git reference.
- **GitHub Pages Hosting:** Hosted on GitHub Pages, ensuring easy access and deployment.
- **Vendor and Host Independence:** Core relies on Git's smart protocol, enabling flexibility across vendors and hosts.

## Workflow:
1. **Open Markdown from GitHub Link:** Access Markdown files from GitHub repositories.
2. **Edit Markdown in Rich Text Editor:** Use QuillJS to edit Markdown content with ease.
3. **Annotate and Discuss:** Add comments, discuss sections, and collaborate in real-time.
4. **Track Changes:** All changes and annotations are tracked within a separate Git reference.
5. **Commit Changes:** Once consensus is reached, commit a new version back to the origin branch.

## Important Note:
- **Private Research Side Project:** Colibri is a private research side project and not intended for production use.
- **GitHub Pages Hosting:** Hosted on GitHub Pages, with communication via an Isomorphic GitHub CORS proxy.
