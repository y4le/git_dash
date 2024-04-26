### Ginterface
This project is a tiny web app that acts as a multi-repo github dashboard hosted by github itself.


### Usage

Visit https://y4le.github.io/git_dash and add any repos you want to track

Get a sharable link by clicking the footer. e.g. https://y4le.github.io/git_dash?sort=date&repoList=["tensorflow%2Ftensorflow"%2C"pytorch%2Fpytorch"]

You can add and remove repos using the UI or by editing the URL directly. All state is stored in the URL to facilitate bookmarking and URL sharing.


### TODO
- [X] display last commit
- [X] add/remove UI
- [X] acceptable CSS
- [X] store state in query string params
- [X] host in gh pages
- [ ] list reordering
- [X] sorting
- [X] links to repo/commit/author
- [X] better datetime display
- [X] collapsed mode
- [X] text mode
