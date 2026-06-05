import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AudiotoolProjectError,
  audiotoolProjectReferenceToName,
  getAudiotoolProjectDetails,
  inspectAudiotoolProjectReference,
  openAudiotoolProject,
  parseAudiotoolProjectReference
} from '../src/index.js';

const projectId = '12345678-1234-1234-1234-123456789abc';

describe('Audiotool project references', () => {
  it('parses beta studio project URLs', () => {
    const reference = parseAudiotoolProjectReference(
      `https://beta.audiotool.com/studio?project=${projectId}`
    );

    assert.equal(reference.type, 'url');
    assert.equal(reference.projectId, projectId);
    assert.equal(reference.projectName, `projects/${projectId}`);
    assert.equal(reference.projectUrl, `https://beta.audiotool.com/studio?project=${projectId}`);
    assert.equal(reference.openReference, `https://beta.audiotool.com/studio?project=${projectId}`);
  });

  it('parses UUIDs and resource names', () => {
    assert.deepEqual(
      parseAudiotoolProjectReference(projectId),
      {
        input: projectId,
        type: 'project',
        projectId,
        projectName: `projects/${projectId}`,
        projectUrl: `https://beta.audiotool.com/studio?project=${projectId}`,
        openReference: projectId
      }
    );
    assert.equal(
      audiotoolProjectReferenceToName(`projects/${projectId}`),
      `projects/${projectId}`
    );
  });

  it('throws when project details cannot be addressed as projects/{id}', () => {
    assert.throws(
      () => audiotoolProjectReferenceToName('draft-without-uuid'),
      AudiotoolProjectError
    );
  });

  it('fetches project details from a project URL using getProject', async () => {
    const calls = [];
    const client = {
      projects: {
        async getProject(request) {
          calls.push(request);
          return {
            project: {
              name: request.name,
              displayName: 'My Audiotool Project'
            }
          };
        }
      }
    };
    const result = await getAudiotoolProjectDetails(
      client,
      `https://beta.audiotool.com/studio?project=${projectId}`
    );

    assert.deepEqual(calls, [{ name: `projects/${projectId}` }]);
    assert.equal(result.reference.projectId, projectId);
    assert.equal(result.project.displayName, 'My Audiotool Project');
  });

  it('opens a project URL through the normalized open reference', async () => {
    const calls = [];
    const client = {
      async open(project) {
        calls.push(project);
        return {
          async start() {
            calls.push('start');
          }
        };
      }
    };

    await openAudiotoolProject(client, `https://beta.audiotool.com/studio?project=${projectId}`);

    assert.deepEqual(calls, [
      `https://beta.audiotool.com/studio?project=${projectId}`,
      'start'
    ]);
  });

  it('can fetch details and inspect a project reference with one helper', async () => {
    const { createOfflineDocument } = await import('@audiotool/nexus');
    const opened = await createOfflineDocument({ validated: false });

    await opened.modify((t) => {
      const player = t.create('heisenberg', { displayName: 'Reference Synth' });
      t.create('noteTrack', {
        orderAmongTracks: 0,
        player: player.location,
        isEnabled: true
      });
    });

    const client = {
      projects: {
        async getProject(request) {
          return {
            project: {
              name: request.name,
              displayName: 'Reference Project'
            }
          };
        }
      },
      async open() {
        return opened;
      }
    };
    const result = await inspectAudiotoolProjectReference(
      client,
      `https://beta.audiotool.com/studio?project=${projectId}`,
      {
        start: false,
        stop: false
      }
    );

    assert.equal(result.details.project.displayName, 'Reference Project');
    assert.equal(result.manifest.tracks[0].label, 'Track 1 - Reference Synth');
  });
});
