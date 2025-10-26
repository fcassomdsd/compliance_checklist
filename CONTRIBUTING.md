---

# 🤝 **2. CONTRIBUTING.md**

```markdown
# Contributing Guide

Thank you for considering contributing to this project! 🎉  
We welcome all contributions, from small fixes to major improvements.

---

## 🧭 Branch Workflow

We follow a **main / develop** branching model:

- **main** → always stable and production-ready.
- **develop** → active development branch.
- **feature/** → new features (`feature/add-logging-module`).
- **fix/** → bug fixes (`fix/ui-freeze`).
- **hotfix/** → urgent fixes to main (`hotfix/crash-fix`).

Example workflow:

```bash
git checkout develop
git pull
git checkout -b feature/awesome-improvement
# work...
git commit -m "feat: add awesome improvement"
git push origin feature/awesome-improvement

Then create a Merge Request (MR) to develop.

🧱 Code Style

Use ESLint + Prettier (configured in repo).

Use Conventional Commits for messages:

feat:, fix:, chore:, docs:, test:, refactor:, etc.

Write meaningful commit messages:

✅ fix: correct schema validation error

❌ update stuff

🧪 Testing

Run tests before submitting a Merge Request:
```
