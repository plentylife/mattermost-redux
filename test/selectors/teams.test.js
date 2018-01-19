// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import assert from 'assert';

import deepFreezeAndThrowOnMutation from 'utils/deep_freeze';
import TestHelper from 'test/test_helper';
import * as Selectors from 'selectors/entities/teams';
import {General} from 'constants';

describe('Selectors.Teams', () => {
    const team1 = TestHelper.fakeTeamWithId();
    const team2 = TestHelper.fakeTeamWithId();
    const team3 = TestHelper.fakeTeamWithId();
    const team4 = TestHelper.fakeTeamWithId();

    const teams = {};
    teams[team1.id] = team1;
    teams[team2.id] = team2;
    teams[team3.id] = team3;
    teams[team4.id] = team4;
    team1.display_name = 'Marketeam';
    team2.display_name = 'Core Team';
    team3.allow_open_invite = true;
    team4.allow_open_invite = true;

    const user = TestHelper.fakeUserWithId();
    const user2 = TestHelper.fakeUserWithId();
    const user3 = TestHelper.fakeUserWithId();
    const profiles = {};
    profiles[user.id] = user;
    profiles[user2.id] = user2;
    profiles[user3.id] = user3;

    const myMembers = {};
    myMembers[team1.id] = {team_id: team1.id, user_id: user.id, roles: General.TEAM_USER_ROLE, mention_count: 1};
    myMembers[team2.id] = {team_id: team2.id, user_id: user.id, roles: General.TEAM_USER_ROLE, mention_count: 3};

    const membersInTeam = {};
    membersInTeam[team1.id] = {};
    membersInTeam[team1.id][user2.id] = {team_id: team1.id, user_id: user2.id, roles: General.TEAM_USER_ROLE};
    membersInTeam[team1.id][user3.id] = {team_id: team1.id, user_id: user3.id, roles: General.TEAM_USER_ROLE};

    const testState = deepFreezeAndThrowOnMutation({
        entities: {
            users: {
                currentUserId: user.id,
                profiles
            },
            teams: {
                currentTeamId: team1.id,
                teams,
                myMembers,
                membersInTeam
            }
        }
    });

    it('getTeamsList', () => {
        assert.deepEqual(Selectors.getTeamsList(testState), [team1, team2, team3, team4]);
    });

    it('getMyTeams', () => {
        assert.deepEqual(Selectors.getMyTeams(testState), [team1, team2]);
    });

    it('getMembersInCurrentTeam', () => {
        assert.deepEqual(Selectors.getMembersInCurrentTeam(testState), membersInTeam[team1.id]);
    });

    it('getTeamMember', () => {
        assert.deepEqual(Selectors.getTeamMember(testState, team1.id, user2.id), membersInTeam[team1.id][user2.id]);
    });

    it('getJoinableTeams', () => {
        const openTeams = {};
        openTeams[team3.id] = team3;
        openTeams[team4.id] = team4;
        assert.deepEqual(Selectors.getJoinableTeams(testState), openTeams);
    });

    it('isCurrentUserCurrentTeamAdmin', () => {
        assert.deepEqual(Selectors.isCurrentUserCurrentTeamAdmin(testState), false);
    });

    it('getMyTeamMember', () => {
        assert.deepEqual(Selectors.getMyTeamMember(testState, team1.id), myMembers[team1.id]);
    });

    it('getTeam', () => {
        const modifiedState = {
            ...testState,
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    teams: {
                        ...testState.entities.teams.teams,
                        [team3.id]: {
                            ...team3,
                            allow_open_invite: false
                        }
                    }
                }
            }
        };

        const fromOriginalState = Selectors.getTeam(testState, team1.id);
        const fromModifiedState = Selectors.getTeam(modifiedState, team1.id);
        assert.ok(fromOriginalState === fromModifiedState);
    });

    it('getJoinableTeamIds', () => {
        const modifiedState = {
            ...testState,
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    teams: {
                        ...testState.entities.teams.teams,
                        [team3.id]: {
                            ...team3,
                            display_name: 'Welcome'
                        }
                    }
                }
            }
        };

        const fromOriginalState = Selectors.getJoinableTeamIds(testState);
        const fromModifiedState = Selectors.getJoinableTeamIds(modifiedState);
        assert.ok(fromOriginalState === fromModifiedState);
    });

    it('getMySortedTeamIds', () => {
        const modifiedState = {
            ...testState,
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    teams: {
                        ...testState.entities.teams.teams,
                        [team3.id]: {
                            ...team3,
                            display_name: 'Welcome'
                        }
                    }
                }
            }
        };

        const updateState = {
            ...testState,
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    teams: {
                        ...testState.entities.teams.teams,
                        [team2.id]: {
                            ...team2,
                            display_name: 'Yankz'
                        }
                    }
                }
            }
        };

        const fromOriginalState = Selectors.getMySortedTeamIds(testState);
        const fromModifiedState = Selectors.getMySortedTeamIds(modifiedState);
        const fromUpdateState = Selectors.getMySortedTeamIds(updateState);

        assert.ok(fromOriginalState === fromModifiedState);
        assert.ok(fromModifiedState[0] === team2.id);

        assert.ok(fromModifiedState !== fromUpdateState);
        assert.ok(fromUpdateState[0] === team1.id);
    });

    it('getMyTeamsCount', () => {
        const modifiedState = {
            ...testState,
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    teams: {
                        ...testState.entities.teams.teams,
                        [team3.id]: {
                            ...team3,
                            display_name: 'Welcome'
                        }
                    }
                }
            }
        };

        const updateState = {
            ...testState,
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    myMembers: {
                        ...testState.entities.teams.myMembers,
                        [team3.id]: {team_id: team3.id, user_id: user.id, roles: General.TEAM_USER_ROLE}
                    }
                }
            }
        };

        const fromOriginalState = Selectors.getMyTeamsCount(testState);
        const fromModifiedState = Selectors.getMyTeamsCount(modifiedState);
        const fromUpdateState = Selectors.getMyTeamsCount(updateState);

        assert.ok(fromOriginalState === fromModifiedState);
        assert.ok(fromModifiedState === 2);

        assert.ok(fromModifiedState !== fromUpdateState);
        assert.ok(fromUpdateState === 3);
    });

    it('getChannelDrawerBadgeCount', () => {
        const mentions = Selectors.getChannelDrawerBadgeCount(testState);
        assert.ok(mentions === 3);
    });

    it('getTeamMentions', () => {
        const factory1 = Selectors.makeGetBadgeCountForTeamId();
        const factory2 = Selectors.makeGetBadgeCountForTeamId();
        const factory3 = Selectors.makeGetBadgeCountForTeamId();

        const mentions1 = factory1(testState, team1.id);
        assert.ok(mentions1 === 1);

        const mentions2 = factory2(testState, team2.id);
        assert.ok(mentions2 === 3);

        // Not a member of the team
        const mentions3 = factory3(testState, team3.id);
        assert.ok(mentions3 === 0);
    });

    describe('makeGetBadgeCountFromChannels', () => {
        const getBadgeCountFromChannels = Selectors.makeGetBadgeCountFromChannels();

        const state = {
            entities: {
                channels: {
                    channels: {
                        1000: {id: '1000', team_id: 'abcd', total_msg_count: 10},
                        1001: {id: '1001', team_id: 'abcd', total_msg_count: 15},
                        1002: {id: '1002', team_id: 'efgh', total_msg_count: 6},
                        1003: {id: '1003', team_id: 'efgh', total_msg_count: 7},
                        1004: {id: '1004', team_id: 'ijkl', total_msg_count: 20}
                    },
                    channelsInTeam: {
                        abcd: ['1000', '1001'],
                        efgh: ['1002', '1003'],
                        ijkl: ['1004', '1005']
                    },
                    myMembers: {
                        1000: {channel_id: '1000', user_id: 'aaaa', mention_count: 0, msg_count: 8},
                        1001: {channel_id: '1001', user_id: 'aaaa', mention_count: 0, msg_count: 12},
                        1002: {channel_id: '1002', user_id: 'aaaa', mention_count: 3, msg_count: 4},
                        1003: {channel_id: '1003', user_id: 'aaaa', mention_count: 2, msg_count: 10},
                        1004: {channel_id: '1004', user_id: 'aaaa', mention_count: 0, msg_count: 20}
                    }
                }
            }
        };

        it('only unread messages', () => {
            const actual = getBadgeCountFromChannels(state, 'abcd');
            const expected = -1;

            assert.equal(actual, expected);
        });

        it('unread messages and mentions', () => {
            const actual = getBadgeCountFromChannels(state, 'efgh');
            const expected = 5;

            assert.equal(actual, expected);
        });

        it('no unreads', () => {
            const actual = getBadgeCountFromChannels(state, 'ijkl');
            const expected = 0;

            assert.equal(actual, expected);
        });
    });
});
