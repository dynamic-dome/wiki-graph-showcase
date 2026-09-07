import json
import pytest
from tools import build


def test_excluded_pages_are_removed_from_disk_on_rebuild(mini_vault, tmp_path):
    out = tmp_path / 'preview'
    cfg = {'vault_root': str(mini_vault), 'include': ['wiki/concepts/*.md'],
           'default_center': 'wiki/concepts/schwarzes-loch', 'output_subdir': 'test'}
    build.run(cfg, out)
    stale = out / 'assets/test/nodes/wiki__concepts__schwarzschild-metrik.json'
    assert stale.exists()
    sibling = out / 'assets/other/nodes/keep.json'
    sibling.parent.mkdir(parents=True)
    sibling.write_text('{}')
    cfg['exclude'] = ['wiki/concepts/schwarzschild-metrik.md']
    build.run(cfg, out)
    assert not stale.exists()
    assert sibling.exists()
    graph = json.loads((out / 'assets/test/graph.json').read_text())
    assert all('schwarzschild-metrik' not in node['id'] for node in graph['nodes'])


def test_dataset_output_cannot_escape_assets(mini_vault, tmp_path):
    cfg = {'vault_root': str(mini_vault), 'include': ['wiki/concepts/*.md'],
           'default_center': 'wiki/concepts/schwarzes-loch', 'output_subdir': '../../outside'}
    with pytest.raises(ValueError, match='inside'):
        build.run(cfg, tmp_path / 'preview')
