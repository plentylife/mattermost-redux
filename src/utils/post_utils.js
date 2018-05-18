// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {General, Posts, Preferences, Permissions} from 'constants';

import {hasNewPermissions} from 'selectors/entities/general';
import {haveIChannelPermission} from 'selectors/entities/roles';

import {generateId} from './helpers';
import {getPreferenceKey} from './preference_utils';

const MAX_COMBINED_SYSTEM_POSTS = 100;

export function isPostFlagged(postId, myPreferences) {
    const key = getPreferenceKey(Preferences.CATEGORY_FLAGGED_POST, postId);
    return myPreferences.hasOwnProperty(key);
}

export function isSystemMessage(post) {
    return post.type !== '' && post.type && post.type.startsWith(Posts.SYSTEM_MESSAGE_PREFIX);
}

export function isFromWebhook(post) {
    return post.props && post.props.from_webhook;
}

export function isPostEphemeral(post) {
    return post.type === Posts.POST_TYPES.EPHEMERAL || post.type === Posts.POST_TYPES.EPHEMERAL_ADD_TO_CHANNEL || post.state === Posts.POST_DELETED;
}

export function shouldIgnorePost(post) {
    return Posts.IGNORE_POST_TYPES.includes(post.type);
}

export function isUserActivityPost(postType) {
    return Posts.USER_ACTIVITY_POST_TYPES.includes(postType);
}

export function isPostOwner(userId, post) {
    return userId === post.user_id;
}

export function isEdited(post) {
    return post.edit_at > 0;
}

export function canDeletePost(state, config, license, teamId, channelId, userId, post, isAdmin, isSystemAdmin) {
    if (!post) {
        return false;
    }

    const isOwner = isPostOwner(userId, post);

    if (hasNewPermissions(state)) {
        const canDelete = haveIChannelPermission(state, {team: teamId, channel: channelId, permission: Permissions.DELETE_POST});
        if (!isOwner) {
            return canDelete && haveIChannelPermission(state, {team: teamId, channel: channelId, permission: Permissions.DELETE_OTHERS_POSTS});
        }
        return canDelete;
    }

    if (license.IsLicensed === 'true') {
        return (config.RestrictPostDelete === General.PERMISSIONS_ALL && (isOwner || isAdmin)) ||
            (config.RestrictPostDelete === General.PERMISSIONS_TEAM_ADMIN && isAdmin) ||
            (config.RestrictPostDelete === General.PERMISSIONS_SYSTEM_ADMIN && isSystemAdmin);
    }
    return isOwner || isAdmin;
}

export function canEditPost(state, config, license, teamId, channelId, userId, post) {
    if (!post || isSystemMessage(post)) {
        return false;
    }

    const isOwner = isPostOwner(userId, post);

    let canEdit = true;

    if (canEdit && license.IsLicensed === 'true') {
        if (hasNewPermissions(state)) {
            canEdit = canEdit && haveIChannelPermission(state, {team: teamId, channel: channelId, permission: Permissions.EDIT_POST});
            if (!isOwner) {
                canEdit = canEdit && haveIChannelPermission(state, {team: teamId, channel: channelId, permission: Permissions.EDIT_OTHERS_POSTS});
            }
            if (config.PostEditTimeLimit !== '-1' && config.PostEditTimeLimit !== -1) {
                const timeLeft = (post.create_at + (config.PostEditTimeLimit * 1000)) - Date.now();
                if (timeLeft <= 0) {
                    canEdit = false;
                }
            }
        } else {
            canEdit = isOwner && config.AllowEditPost !== 'never';
            if (config.AllowEditPost === General.ALLOW_EDIT_POST_TIME_LIMIT) {
                const timeLeft = (post.create_at + (config.PostEditTimeLimit * 1000)) - Date.now();
                if (timeLeft <= 0) {
                    canEdit = false;
                }
            }
        }
    } else {
        canEdit = canEdit && isOwner;
    }
    return canEdit;
}

export function editDisable(state, config, license, teamId, channelId, userId, post, editDisableAction) {
    const canEdit = canEditPost(state, config, license, teamId, channelId, userId, post);

    if (canEdit && license.IsLicensed === 'true') {
        if (config.AllowEditPost === General.ALLOW_EDIT_POST_TIME_LIMIT || (config.PostEditTimeLimit !== -1 && config.PostEditTimeLimit !== '-1')) {
            const timeLeft = (post.create_at + (config.PostEditTimeLimit * 1000)) - Date.now();
            if (timeLeft > 0) {
                editDisableAction.fireAfter(timeLeft + 1000);
            }
        }
    }
}

export function getLastCreateAt(postsArray) {
    const createAt = postsArray.map((p) => p.create_at);

    if (createAt.length) {
        return Reflect.apply(Math.max, null, createAt);
    }

    return 0;
}

const joinLeavePostTypes = [
    Posts.POST_TYPES.JOIN_LEAVE,
    Posts.POST_TYPES.JOIN_CHANNEL,
    Posts.POST_TYPES.LEAVE_CHANNEL,
    Posts.POST_TYPES.ADD_REMOVE,
    Posts.POST_TYPES.ADD_TO_CHANNEL,
    Posts.POST_TYPES.REMOVE_FROM_CHANNEL,
    Posts.POST_TYPES.JOIN_TEAM,
    Posts.POST_TYPES.LEAVE_TEAM,
    Posts.POST_TYPES.ADD_TO_TEAM,
    Posts.POST_TYPES.REMOVE_FROM_TEAM,
];

// Returns true if a post should be hidden when the user has Show Join/Leave Messages disabled
export function shouldFilterJoinLeavePost(post, showJoinLeave, currentUsername) {
    if (showJoinLeave) {
        return false;
    }

    // Don't filter out non-join/leave messages
    if (joinLeavePostTypes.indexOf(post.type) === -1) {
        return false;
    }

    // Don't filter out join/leave messages about the current user
    if (post.props) {
        if (post.props.username === currentUsername ||
            post.props.addedUsername === currentUsername ||
            post.props.removedUsername === currentUsername) {
            return false;
        }
    }

    return true;
}

export function isPostPendingOrFailed(post) {
    return post.failed || post.id === post.pending_post_id;
}

export function comparePosts(a, b) {
    const aIsPendingOrFailed = isPostPendingOrFailed(a);
    const bIsPendingOrFailed = isPostPendingOrFailed(b);
    if (aIsPendingOrFailed && !bIsPendingOrFailed) {
        return -1;
    } else if (!aIsPendingOrFailed && bIsPendingOrFailed) {
        return 1;
    }

    if (a.create_at > b.create_at) {
        return -1;
    } else if (a.create_at < b.create_at) {
        return 1;
    }

    return 0;
}

function extractUserActivityData(userActivities) {
    const postTypePriority = {
        [Posts.POST_TYPES.JOIN_TEAM]: 0,
        [Posts.POST_TYPES.ADD_TO_TEAM]: 1,
        [Posts.POST_TYPES.REMOVE_FROM_TEAM]: 2,
        [Posts.POST_TYPES.LEAVE_TEAM]: 3,
        [Posts.POST_TYPES.JOIN_CHANNEL]: 4,
        [Posts.POST_TYPES.ADD_TO_CHANNEL]: 5,
        [Posts.POST_TYPES.REMOVE_FROM_CHANNEL]: 6,
        [Posts.POST_TYPES.LEAVE_CHANNEL]: 7,
    };

    const messageData = [];
    const allUserIds = [];

    Object.entries(userActivities).forEach(([postType, values]) => {
        if (
            postType === Posts.POST_TYPES.ADD_TO_TEAM ||
            postType === Posts.POST_TYPES.ADD_TO_CHANNEL
        ) {
            Object.entries(values).forEach(([actorId, userIds]) => {
                messageData.push({postType, userIds, actorId});
                allUserIds.push(...userIds, actorId);
            });
        } else {
            messageData.push({postType, userIds: values});
            allUserIds.push(...values);
        }
    });

    messageData.sort((a, b) => postTypePriority[a.postType] > postTypePriority[b.postType]);

    return {
        allUserIds: allUserIds.reduce((acc, curr) => {
            if (!acc.includes(curr)) {
                acc.push(curr);
            }
            return acc;
        }, []),
        messageData,
    };
}

export function combineUserActivitySystemPost(systemPosts = []) {
    if (systemPosts.length === 0) {
        return null;
    }

    const userActivities = systemPosts.reduce((acc, post) => {
        const postType = post.type;
        let userActivityProps = acc;
        const combinedPostType = userActivityProps[postType];

        if (
            postType === Posts.POST_TYPES.ADD_TO_TEAM ||
            postType === Posts.POST_TYPES.ADD_TO_CHANNEL
        ) {
            if (combinedPostType) {
                const addedUserIds = combinedPostType[post.user_id] || [];
                if (!addedUserIds.includes(post.props.addedUserId)) {
                    addedUserIds.push(post.props.addedUserId);
                    combinedPostType[post.user_id] = addedUserIds;
                }
            } else {
                userActivityProps[postType] = {[post.user_id]: [post.props.addedUserId]};
            }
        } else {
            let propsUserId = post.user_id;
            if (postType === Posts.POST_TYPES.REMOVE_FROM_CHANNEL) {
                propsUserId = post.props.removedUserId;
            }

            if (combinedPostType) {
                if (!combinedPostType.includes(propsUserId)) {
                    userActivityProps[postType] = [...combinedPostType, propsUserId];
                }
            } else {
                userActivityProps = {...userActivityProps, [postType]: [propsUserId]};
            }
        }

        return userActivityProps;
    }, {});

    return extractUserActivityData(userActivities);
}

export function combineSystemPosts(postsIds = [], posts = {}, channelId) {
    if (postsIds.length === 0) {
        return {postsForChannel: postsIds, nextPosts: posts};
    }

    const postsForChannel = [];
    const nextPosts = {...posts};

    let userActivitySystemPosts = [];
    let systemPostIds = [];
    let messages = [];
    let createAt;
    let combinedPostId;

    postsIds.forEach((p, i) => {
        const channelPost = posts[p];
        const combinedOrUserActivityPost = isUserActivityPost(channelPost.type) || channelPost.type === Posts.POST_TYPES.COMBINED_USER_ACTIVITY;
        if (channelPost.delete_at === 0 && combinedOrUserActivityPost) {
            if (!createAt || createAt > channelPost.create_at) {
                createAt = channelPost.create_at;
            }

            if (isUserActivityPost(channelPost.type)) {
                userActivitySystemPosts.push(channelPost);
                systemPostIds.push(channelPost.id);
                messages.push(channelPost.message);

                if (nextPosts[channelPost.id]) {
                    nextPosts[channelPost.id] = {...channelPost, state: Posts.POST_DELETED, delete_at: 1};
                }
            } else if (channelPost.type === Posts.POST_TYPES.COMBINED_USER_ACTIVITY) {
                userActivitySystemPosts.push(...channelPost.user_activity_posts);
                systemPostIds.push(...channelPost.system_post_ids);
                messages.push(...channelPost.props.messages);

                combinedPostId = channelPost.id;
            }
        }
        if (
            (!combinedOrUserActivityPost && userActivitySystemPosts.length > 0) ||
            userActivitySystemPosts.length === MAX_COMBINED_SYSTEM_POSTS ||
            (userActivitySystemPosts.length > 0 && i === postsIds.length - 1)
        ) {
            const combinedPost = {
                id: combinedPostId || generateId(),
                root_id: '',
                channel_id: channelId,
                create_at: createAt,
                delete_at: 0,
                message: messages.join('\n'),
                props: {
                    messages,
                    user_activity: combineUserActivitySystemPost(userActivitySystemPosts),
                },
                state: '',
                system_post_ids: systemPostIds,
                type: Posts.POST_TYPES.COMBINED_USER_ACTIVITY,
                user_activity_posts: userActivitySystemPosts,
                user_id: '',
            };

            nextPosts[combinedPost.id] = combinedPost;
            postsForChannel.push(combinedPost.id);

            userActivitySystemPosts = [];
            systemPostIds = [];
            messages = [];
            createAt = null;
            combinedPostId = null;

            if (!combinedOrUserActivityPost) {
                postsForChannel.push(channelPost.id);
            }
        } else if (!combinedOrUserActivityPost) {
            postsForChannel.push(channelPost.id);
        }
    });

    postsForChannel.sort((a, b) => {
        return comparePosts(nextPosts[a], nextPosts[b]);
    });

    return {postsForChannel, nextPosts};
}
