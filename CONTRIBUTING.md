---

# 🤝 **2. CONTRIBUTING.md**

```markdown
# Contributing Guide

Thank you for considering contributing to the Compliance Checklist App! 🎉
We welcome all contributions, from small documentation fixes to major feature improvements.

Please ensure you have read the **CODE_OF_CONDUCT.md** before starting.

---

## 🧭 1. Branch Workflow

We follow a **main / develop** branching model:

* **`main`** → always stable and production-ready.
* **`develop`** → active development branch. **All Merge Requests (MRs) should target this branch.**
* **`feature/`** → New features (`feature/add-logging-module`).
* **`fix/`** → Bug fixes (`fix/ui-freeze`).
* **`hotfix/`** → Urgent fixes to main (`hotfix/crash-fix`).

### Example Feature Workflow

```bash
# 1. Start on develop and pull latest changes
git checkout develop
git pull

# 2. Create a new branch for your feature
git checkout -b feature/awesome-improvement

# 3. Work and commit using Conventional Commits
# work...
git commit -m "feat: add awesome improvement"

# 4. Push your branch
git push origin feature/awesome-improvement

# 5. Create a Merge Request (MR) targeting the 'develop' branch.

2. Code Style & Tooling

Consistency is key. We rely on standard tooling for quality control.

Linting and Formatting

All code must pass checks enforced by ESLint and formatted by Prettier. The configuration files (.eslintrc.* and .prettierrc.*) are included in the repository.

Conventional Commits

We use Conventional Commits for clear, standardized commit history. Use the following prefixes in your commit messages:
Type	When to Use	Example
feat:	A new feature	feat: introduce dynamic checklist loading
fix:	A bug fix	fix: correct schema validation error
chore:	Maintenance, build process, or tooling changes	chore: update dependencies
docs:	Documentation only changes	docs: clarify installation steps in README
test:	Adding or correcting tests	test: add unit test for fileServices
refactor:	Code change that neither fixes a bug nor adds a feature	refactor: simplify Pinia store setup

Write meaningful commit messages:

    ✅ fix: correct schema validation error

    ❌ update stuff

🧪 3. Testing

You must run tests locally and ensure they pass before submitting a Merge Request.
Bash

# Run all unit and integration tests
npm test

📬 4. Merge Request (MR) Checklist

To ensure a smooth review process, please include the following in your Merge Request description:

    Summary: A brief description of the change and its scope.

    Type: (e.g., feat, fix, refactor)

    Testing: Detail how you tested the changes (e.g., tested on Windows 10, all unit tests passed).

    Checklist:

        [ ] My code follows the project's Code Style and formatting rules.

        [ ] I have performed a self-review of my own code.

        [ ] I have updated documentation where necessary.

        [ ] New and existing tests pass (npm test).

        [ ] My commit messages use Conventional Commits.
