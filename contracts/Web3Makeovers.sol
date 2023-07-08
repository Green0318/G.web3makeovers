// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import './Standards/ERC5633.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';
import '@openzeppelin/contracts/utils/Address.sol';

/// @author Leonid Shaydenko (@lssleo)

contract Web3Makeovers is ERC5633, AccessControl, Ownable {
    using Address for address payable;

    bytes32 public constant ADMIN_ROLE = keccak256('ADMIN_ROLE');

    struct Data {
        bool initialized;
        uint price;
        bool whitelistRequired;
    }

    mapping(uint => Data) private tokens;
    mapping(address => mapping(uint => bool)) private whitelist;

    event TokenMinted(address indexed to, uint tokenId, uint amount);
    event TokenInitialized(
        uint indexed tokenId,
        string tokenUri,
        uint price,
        bool whitelistRequired,
        bool isSoulbound
    );
    event TokenWhitelistRequiredStatusUpdated(uint tokenId, bool newStatus);
    event TokenPriceUpdated(uint tokenId, uint newPrice);
    event TokenUriUpdated(uint tokenId, string newUri);
    event Whitelisted(uint tokenId, address[] addresses);
    event RemovedFromWhitelist(uint tokenId, address[] addresses);
    event Withdrawed(uint amount);

    constructor() ERC1155('') ERC5633() {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(ADMIN_ROLE, _msgSender());
    }

    /*/////////////////////////////////////////////////////////////////// 
                                 MAIN FUNCTIONS
    ///////////////////////////////////////////////////////////////////*/

    /// @notice Mints a specified amount of tokens to the specified address
    /// @param _to - The address that the tokens will be minted to
    /// @param _tokenId - The ID of the token to be minted
    /// @param _amount - The amount of tokens to be minted
    /// @dev The function can only be called by the admin and default admin role, which restricts access to authorized parties

    function mint(address _to, uint _tokenId, uint _amount) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) || hasRole(ADMIN_ROLE, _msgSender()),
            'Web3Makeovers: Access denied'
        );
        require(isInitialized(_tokenId), 'Web3Makeovers: Token not initialized');
        _mint(_to, _tokenId, _amount, '');
        emit TokenMinted(_to, _tokenId, _amount);
    }

    /// @notice Mints a single token to the caller's address by sending the required payment
    /// @param _tokenId The ID of the token to be minted
    /// @dev The function requires the token to be initialized and the sent value to match the token's price.
    /// @dev If whitelist is required for the token, the caller must be whitelisted.
    /// @dev Emits a TokenMinted event with the caller's address and the minted token details.

    function mintPublic(uint _tokenId) external payable {
        require(isInitialized(_tokenId), 'Web3Makeovers: Token not initialized');
        require(getTokenPrice(_tokenId) == msg.value, 'Web3Makeovers: Wrong value');
        if (getWhitelistRequiredStatus(_tokenId)) {
            require(
                isWhitelisted(_msgSender(), _tokenId),
                'Web3Makeovers: Caller not whitelisted!'
            );
            whitelist[_msgSender()][_tokenId] = false;
        }
        _mint(_msgSender(), _tokenId, 1, '');
        emit TokenMinted(_msgSender(), _tokenId, 1);
    }

    /// @notice Sets the metadata URI and soulbound status for a specified token ID, only callable by the admin and default admin role
    /// @param _tokenId - The ID of the token to set metadata and soulbound status for
    /// @param _tokenUri - The URI for the token's metadata
    /// @param _price - The Price for specified token
    /// @param _whitelistRequired - The status of whitelist required
    /// @param _soulbound - A boolean indicating whether the token is soulbound or not
    /// @dev Checks if the token has already been initialized, and if not, sets the URI and soulbound status for the specified token ID

    function initializeToken(
        uint _tokenId,
        string memory _tokenUri,
        uint _price,
        bool _whitelistRequired,
        bool _soulbound
    ) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) || hasRole(ADMIN_ROLE, _msgSender()),
            'Web3Makeovers: Access denied'
        );
        require(!isInitialized(_tokenId), 'Web3Makeovers: Already initialized');
        tokens[_tokenId].initialized = true;
        tokens[_tokenId].price = _price;
        tokens[_tokenId].whitelistRequired = _whitelistRequired;
        _setURI(_tokenId, _tokenUri);
        _setSoulbound(_tokenId, _soulbound);
        emit TokenInitialized(_tokenId, _tokenUri, _price, _whitelistRequired, _soulbound);
    }

    /// @notice Withdraws the contract balance to the owner's address
    /// @dev The function can only be called by the contract owner.
    /// @dev Emits a Withdrawed event with the withdrawn amount.

    function withdraw() external onlyOwner {
        uint contractBalance = address(this).balance;
        require(contractBalance > 0, 'Web3Makeovers: Balance is zero');
        emit Withdrawed(contractBalance);
        payable(owner()).sendValue(contractBalance);
    }

    /*/////////////////////////////////////////////////////////////////// 
                                 SETTER FUNCTIONS
    ///////////////////////////////////////////////////////////////////*/

    /// @notice Adds multiple addresses to the whitelist for a specified token ID
    /// @param _tokenId The ID of the token to add addresses to the whitelist
    /// @param _addresses The addresses to be added to the whitelist
    /// @dev The function can only be called by the admin and default admin role, which restricts access to authorized parties.
    /// @dev Each address in the _addresses array will be added to the whitelist for the specified token ID.
    /// @dev Emits a Whitelisted event with the token ID and the array of added addresses.

    function addToWhitelist(uint _tokenId, address[] calldata _addresses) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) || hasRole(ADMIN_ROLE, _msgSender()),
            'Web3Makeovers: Access denied'
        );
        for (uint256 i = 0; i < _addresses.length; i++) {
            whitelist[_addresses[i]][_tokenId] = true;
        }
        emit Whitelisted(_tokenId, _addresses);
    }

    /// @notice Removes multiple addresses from the whitelist for a specified token ID
    /// @param _tokenId The ID of the token to remove addresses from the whitelist
    /// @param _addresses The addresses to be removed from the whitelist
    /// @dev The function can only be called by the admin and default admin role, which restricts access to authorized parties.
    /// @dev Each address in the _addresses array will be removed from the whitelist for the specified token ID.
    /// @dev Emits a RemovedFromWhitelist event with the token ID and the array of removed addresses.

    function removeFromWhitelist(uint _tokenId, address[] calldata _addresses) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) || hasRole(ADMIN_ROLE, _msgSender()),
            'Web3Makeovers: Access denied'
        );
        for (uint256 i = 0; i < _addresses.length; i++) {
            whitelist[_addresses[i]][_tokenId] = false;
        }
        emit RemovedFromWhitelist(_tokenId, _addresses);
    }

    /// @notice Sets the whitelist requirement status for a specified token ID
    /// @param _tokenId The ID of the token to set the whitelist requirement status
    /// @param _newStatus The new status of the whitelist requirement (true for required, false for not required)
    /// @dev The function can only be called by the admin and default admin role, which restricts access to authorized parties.
    /// @dev Checks if the current whitelist requirement status of the token is different from the new status.
    /// @dev The token should be already initialized, if not function reverts
    /// @dev If different, updates the whitelist requirement status of the token to the new status.
    /// @dev Emits a TokenWhitelistRequiredStatusUpdated event with the token ID and the new status.

    function setWhitelistRequiredStatus(uint _tokenId, bool _newStatus) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) || hasRole(ADMIN_ROLE, _msgSender()),
            'Web3Makeovers: Access denied'
        );
        require(isInitialized(_tokenId), 'Web3Makeovers: Token not initialized');
        require(
            getWhitelistRequiredStatus(_tokenId) != _newStatus,
            'Web3Makeovers: New status the same'
        );
        tokens[_tokenId].whitelistRequired = _newStatus;
        emit TokenWhitelistRequiredStatusUpdated(_tokenId, _newStatus);
    }

    /// @notice Sets the price for a specified token ID
    /// @param _tokenId The ID of the token to set the price
    /// @param _newPrice The new price to be set for the token
    /// @dev The function can only be called by the admin and default admin role, which restricts access to authorized parties.
    /// @dev Checks if the current price of the token is different from the new price.
    /// @dev The token should be already initialized, if not function reverts
    /// @dev If different, updates the price of the token to the new price.
    /// @dev Emits a TokenPriceUpdated event with the token ID and the new price.

    function setTokenPrice(uint _tokenId, uint _newPrice) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) || hasRole(ADMIN_ROLE, _msgSender()),
            'Web3Makeovers: Access denied'
        );
        require(isInitialized(_tokenId), 'Web3Makeovers: Token not initialized');
        require(getTokenPrice(_tokenId) != _newPrice, 'Web3Makeovers: New price the same');
        tokens[_tokenId].price = _newPrice;
        emit TokenPriceUpdated(_tokenId, _newPrice);
    }

    /// @notice Sets the metadata URI for a specified token ID
    /// @param _tokenId The ID of the token to set the metadata URI
    /// @param _newUri The new URI to be set for the token's metadata
    /// @dev The function can only be called by the admin and default admin role, which restricts access to authorized parties.
    /// @dev The token should be already initialized, if not function reverts
    /// @dev Updates the metadata URI of the token to the new URI using the internal _setURI function.
    /// @dev Emits a TokenUriUpdated event with the token ID and the new URI.

    function setTokenUri(uint _tokenId, string memory _newUri) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) || hasRole(ADMIN_ROLE, _msgSender()),
            'Web3Makeovers: Access denied'
        );
        require(isInitialized(_tokenId), 'Web3Makeovers: Token not initialized');
        _setURI(_tokenId, _newUri);
        emit TokenUriUpdated(_tokenId, _newUri);
    }

    /*/////////////////////////////////////////////////////////////////// 
                                 GETTER FUNCTIONS
    ///////////////////////////////////////////////////////////////////*/

    /// @notice Checks if a token has been initialized
    /// @param _tokenId The ID of the token to check
    /// @return A boolean indicating whether the token has been initialized or not
    /// @dev This function is publicly accessible and can be called to determine if a token with the given ID has been initialized.

    function isInitialized(uint _tokenId) public view returns (bool) {
        return tokens[_tokenId].initialized;
    }

    /// @notice Retrieves the price of a token
    /// @param _tokenId The ID of the token to retrieve the price
    /// @return The price of the token
    /// @dev This function is publicly accessible and can be called to retrieve the price of a token with the given ID.

    function getTokenPrice(uint _tokenId) public view returns (uint) {
        return tokens[_tokenId].price;
    }

    /// @notice Retrieves the whitelist requirement status of a token
    /// @param _tokenId The ID of the token to retrieve the whitelist requirement status
    /// @return A boolean indicating whether the whitelist is required for the token or not
    /// @dev This function is publicly accessible and can be called to retrieve the whitelist requirement status of a token with the given ID.

    function getWhitelistRequiredStatus(uint _tokenId) public view returns (bool) {
        return tokens[_tokenId].whitelistRequired;
    }

    /// @notice Checks if an address is whitelisted for a specific token
    /// @param _addressToCheck The address to check
    /// @param _tokenId The ID of the token to check the whitelist status
    /// @return A boolean indicating whether the address is whitelisted for the token or not
    /// @dev This function is publicly accessible and can be called to check if an address is whitelisted for a specific token.

    function isWhitelisted(address _addressToCheck, uint _tokenId) public view returns (bool) {
        return whitelist[_addressToCheck][_tokenId];
    }

    // The following functions are overrides required by Solidity.

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC5633, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
