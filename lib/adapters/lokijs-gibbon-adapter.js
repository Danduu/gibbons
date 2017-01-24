'use strict';
const util = require('util');
const _ = require('lodash');
const Loki = require('lokijs');
const GibbonAdapter = require('./gibbon-adapter');
const Gibbon = require('../gibbon');


const COLLECTION = {
    USER: 'user',
    GROUP: 'group',
    PERMISSION: 'permission'
};

/**
 * @classdesc Representing an adapter class for LokiJS
 * @classs
 * @extends GibbonAdapter
 * @param {object} [logger] - Logger instance
 */
function LokiJSGibbonAdapter(logger) {
    GibbonAdapter.call(this);

    Object.defineProperty(this, 'EVENT', {
        writable: true,
        enumerable: true,
        configurable: true,
        value: {
            ERROR: 'error',
            EVENT: 'event',
            WARNING: 'warning',
            CLOSE: 'close',
            LOADED: 'loaded'
        }
    });

    Object.defineProperty(this, 'logger', {
        writable: true,
        enumerable: true,
        configurable: false,
        value: logger || console
    });

    Object.defineProperty(this, 'dbCollection', {
        writable: true,
        enumerable: true,
        configurable: false,
        value: {}
    });

    Object.defineProperty(this, 'db', {
        writable: true,
        enumerable: true,
        configurable: false,
        value: null
    });

}

util.inherits(LokiJSGibbonAdapter, GibbonAdapter);

/**
 * This gets a collection when not set, it will be created
 * @param {string} collectionName - document collection to be initialized
 * @private
 */
LokiJSGibbonAdapter.prototype._initializeCollection = function (collectionName) {

    this.dbCollection[collectionName] = this.db.getCollection(collectionName);
    if (!this.dbCollection[collectionName]) {
        this.dbCollection[collectionName] = this.db.addCollection(collectionName, {
            unique: ['name'],
            indices: ['name']
        });
    }

    // Receive events from lokiJS and pass them along:
    this.dbCollection[collectionName].on('warning', (warning) => {
        this.logger.warn(warning);
        this.emit(this.EVENT.WARNING, warning);
    });
    this.dbCollection[collectionName].on('error', (errDoc) => {
        this.logger.error(errDoc);
        this.emit(this.EVENT.ERROR, errDoc);
    });
    this.dbCollection[collectionName].on('close', () => {
        this.emit(this.EVENT.CLOSE);
    });
    this.dbCollection[collectionName].on('loaded', (loaded) => {
        this.emit(this.EVENT.LOADED, loaded);
    });

};


/**
 * Generic Upsert method for user, group and permission collections
 *
 * @param {string} collection - Dynamic pointer to a collection
 * @param {object} criteria - In this adapter name is our unique reference for all collections
 * @param {object} data - Object to update or insert
 * @param {function} callback
 * @private
 */
LokiJSGibbonAdapter.prototype._upsertByName = function (collection, criteria, data, callback) {
    let dataFound = this.dbCollection[collection].findOne({name: criteria.name});
    if (!dataFound) {
        dataFound = this.dbCollection[collection].insert(data);
    } else {
        dataFound = _.merge(dataFound, data);
        try {
            this.dbCollection[collection].update(dataFound);
        } catch (error) {
            return callback(error);
        }
    }
    return callback(null, dataFound);
};

LokiJSGibbonAdapter.prototype._findByName = function (name, criteria, callback) {
    const found = this.dbCollection[name].findOne(criteria);
    callback(null, found);
};

/**
 * Initialize persistence storage itself and it's collections
 * @override
 * @param {function} callback
 */
LokiJSGibbonAdapter.prototype.initialize = function (callback) {
    const self = this;

    this.db = new Loki('lokijs.db', {
        autosave: false,
        autoload: true,
        verbose: true,
        autoloadCallback: loadHandler,
    });

    function loadHandler() {

        // Initialize all collections
        self._initializeCollection(COLLECTION.USER);
        self._initializeCollection(COLLECTION.GROUP);
        self._initializeCollection(COLLECTION.PERMISSION);

        callback();
    }
};

/**
 * Tries to fetch a user
 * @override
 * @param {object} criteria - LokiJS criteria
 * @param {function} callback
 */
LokiJSGibbonAdapter.prototype.findUser = function (criteria, callback) {
    this._findByName(COLLECTION.USER, criteria, callback);
};


LokiJSGibbonAdapter.prototype.findGroup = function (criteria, callback) {
    this._findByName(COLLECTION.GROUP, criteria, callback);
};

LokiJSGibbonAdapter.prototype.findPermission = function (criteria, callback) {
    this._findByName(COLLECTION.PERMISSION, criteria, callback);
};


/**
 * Add a user object to the user collection
 * @param {object} user - The user object
 * @param {function} callback
 */
LokiJSGibbonAdapter.prototype.addUser = function (user, callback) {
    this.dbCollection[COLLECTION.USER].insert(user);
    callback(null, user);
};

/**
 * Add a group object to the group collection
 * @param {object} group - The group object
 * @param {function} callback
 */
LokiJSGibbonAdapter.prototype.addGroup = function (group, callback) {
    this.dbCollection[COLLECTION.GROUP].insert(group);
    callback(null, group);
};

/**
 * Add a groups from array to the group collection
 * @param {Array} groups - The group object
 * @param {function} callback
 */
LokiJSGibbonAdapter.prototype.addGroups = function (groups, callback) {
    if (!(Array.isArray(groups))) {
        return callback(new TypeError('groups not an instance of array'));
    }
    const groupsAdded = [];
    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const groupAdded = this.dbCollection[COLLECTION.GROUP].insert(group);
        groupsAdded.push(groupAdded);
    }
    callback(null, groupsAdded);
};


/**
 * Add a permission object to the permission collection
 * @param {object} permission - The permission object
 * @param {function} callback
 */
LokiJSGibbonAdapter.prototype.addPermission = function (permission, callback) {
    this.dbCollection[COLLECTION.PERMISSION].insert(permission);
    callback(null, permission);
};

/**
 * Add a permission from array to the permission collection
 * @param {Array} permissions - The permission object
 * @param {function} callback
 */
LokiJSGibbonAdapter.prototype.addPermissions = function (permissions, callback) {

    if (!(Array.isArray(permissions))) {
        return callback(new TypeError('permissions not an instance of array'));
    }
    const permissionsAdded = [];
    for (let i = 0; i < permissions.length; i++) {
        const permission = permissions[i];
        const permissionAdded = this.dbCollection[COLLECTION.PERMISSION].insert(permission);
        permissionsAdded.push(permissionAdded);
    }

    callback(null, permissionsAdded);
};


/**
 * Remove a user from the user collection
 * @param user
 * @param callback
 * @returns {*}
 */
LokiJSGibbonAdapter.prototype.removeUser = function (user, callback) {
    try {
        this.dbCollection[COLLECTION.USER].removeWhere({name: user.name});
    } catch (error) {
        return callback(error);
    }
    callback();
};

/**
 * Remove a group from the group collection
 * @param group
 * @param callback
 * @returns {*}
 */
LokiJSGibbonAdapter.prototype.removeGroup = function (group, callback) {
    try {
        this.dbCollection[COLLECTION.GROUP].removeWhere({name: group.name});
    } catch (error) {
        return callback(error);
    }
    callback();
};

/**
 * Remove a permission from the permission collection
 * @param permission
 * @param callback
 * @returns {*}
 */
LokiJSGibbonAdapter.prototype.removePermission = function (permission, callback) {
    try {
        this.dbCollection[COLLECTION.PERMISSION].removeWhere({name: permission.name});
    } catch (error) {
        return callback(error);
    }
    callback();

};

/**
 * Insert or update a user (if not exists)
 * @override
 * @param {object} criteria - Where to find in case of update
 * @param {object} user - The user to update or insert
 * @param {function} callback
 */
LokiJSGibbonAdapter.prototype.upsertUser = function (criteria, user, callback) {
    this._upsertByName(COLLECTION.USER, criteria, user, callback);
};

/**
 * Insert or update group (if not exists)
 * @override
 * @param {object} criteria - LokiJS criteria
 * @param {Gibbon} group
 * @param callback
 */
LokiJSGibbonAdapter.prototype.upsertGroup = function (criteria, group, callback) {
    this._upsertByName(COLLECTION.GROUP, criteria, group, callback);
};

/**
 * Insert or update permissions (if not exists)
 * @override
 * @param {object} criteria - LokiJS criteria
 * @param permission
 * @param callback
 */
LokiJSGibbonAdapter.prototype.upsertPermission = function (criteria, permission, callback) {
    this._upsertByName(COLLECTION.PERMISSION, criteria, permission, callback);
};


/**
 * Tries to fetch a collection of Hats representing groups
 * @override
 * @param {object} user - user object
 * @param callback
 */
LokiJSGibbonAdapter.prototype.findGroupsByUser = function (user, callback) {
    // Fetch user from lokijs
    const userFound = this.dbCollection[COLLECTION.USER].findOne({name: user.name});
    if (!userFound) {
        return callback(new Error('user not found'));
    }
    // construct a new Gibbon instance from encoded groups
    const gibbon = Gibbon.fromString(userFound.groups);
    // Fetch lokijs groups from group collection
    const positions = gibbon.getPositionsArray();
    const criteria = {'$loki': {'$in': positions}};
    const groups = this.dbCollection[COLLECTION.GROUP].find(criteria);
    return callback(null, groups);
};

/**
 * Given a user, it tries to fetch it's permissions
 * @param {object} user - Instance of a user object
 * @param {function} callback
 */
LokiJSGibbonAdapter.prototype.findPermissionsByUser = function (user, callback) {
    const self = this;
    let permissions = [];
    this.findGroupsByUser(user, (err, groups) => {

        if (err) {
            return callback(err);
        }

        let i = 0;
        for (i; i < groups.length; i++) {
            const group = groups[i];
            const permissionsFromGroup = group.permissions;
            const gibbon = Gibbon.fromString(permissionsFromGroup);
            const permissionBitPositions = gibbon.getPositionsArray();
            permissions = permissions.concat(permissionBitPositions);
            permissions = _.uniq(permissions);
        }

        permissions = permissions.sort(function sortNumber(a, b) {
            return a - b;
        });

        const criteria = {'$loki': {'$in': permissions}};
        const permissionsFound = self.dbCollection[COLLECTION.PERMISSION].find(criteria);
        return callback(null, permissionsFound);

    });
};


/**
 * Validate a user against all given permissions <br>
 * When one of the given permissions is missing for the given user,<br>
 * given user is not valid.
 *
 * @param {object} user - User to validate
 * @param {Array<Number>} permissions - Array with unsigned integers with permissions (positions starting at 1)
 * @param {function} callback
 */
LokiJSGibbonAdapter.prototype.validateUserWithAllPermissions = function (user, permissions, callback) {
    let valid = false;
    this.findPermissionsByUser(user, (error, permissionsFound) => {
        if (error) {
            return callback(error, valid);
        }

        if (!(Array.isArray(permissions)) || permissions.length <= 0) {
            return callback(null, valid);
        }
        const permissionsAttachedToUser = _.map(permissionsFound, '$loki');
        const missingPermissions = _.difference(permissions, permissionsAttachedToUser);
        valid = !(Array.isArray(missingPermissions) && missingPermissions.length > 0);
        callback(null, valid);
    });
};

/**
 * Validate a user against any given permissions <br>
 * When one of the given permissions is found for the given user,<br>
 * the outcome is valid.
 *
 * @param {object} user - User to validate
 * @param {Array<Number>} permissions - Array with unsigned integers with permissions (positions starting at 1)
 * @param {function} callback
 */
LokiJSGibbonAdapter.prototype.validateUserWithAnyPermissions = function (user, permissions, callback) {
    let valid = false;
    this.findPermissionsByUser(user, (error, permissionsFound) => {
        if (error) {
            return callback(error, valid);
        }
        if (!(Array.isArray(permissions)) || permissions.length <= 0) {
            return callback(null, valid);
        }
        const permissionsAttachedToUser = _.map(permissionsFound, '$loki');
        const overlappingPermissions = _.intersection(permissions, permissionsAttachedToUser);
        valid = (Array.isArray(overlappingPermissions) && overlappingPermissions.length > 0);
        callback(null, valid);
    });
};

module.exports = LokiJSGibbonAdapter;





