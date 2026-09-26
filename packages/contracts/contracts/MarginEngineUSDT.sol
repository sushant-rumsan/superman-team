// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Minimal interface for ERC-20 (USDT)
interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MarginEngineUSDT {
    address public owner;
    IERC20 public usdtToken;
    uint256 public markPrice; // e.g. 100 * 1e6 for 100 USD (6 decimals)

    mapping(address => uint8) public kycTiers;
    bool public kycEnforced = false;

    struct Position {
        uint256 collateral;   // in USDT units (6 decimals)
        uint256 positionSize; // collateral * leverage
        uint256 entryPrice;   // 6 decimals
        uint8 leverage;       // e.g. 2, 5, 10
        bool isOpen;
    }

    mapping(address => Position) public positions;

    event PositionOpened(address indexed trader, uint256 collateralUSDT, uint8 leverage, uint256 size);
    event PositionClosed(address indexed trader, int256 pnl, uint256 payout);
    event PositionLiquidated(address indexed trader, uint256 seizedUSDT, address liquidator);
    event PriceUpdated(uint256 newPrice);
    event LiquidityAdded(address indexed provider, uint256 amount);
    event LiquidityWithdrawn(address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _usdtAddress, uint256 _initialPrice) {
        owner = msg.sender;
        usdtToken = IERC20(_usdtAddress);
        markPrice = _initialPrice;
    }

    // --- KYC CONFIG ---
    function setKycTier(address _user, uint8 _tier) external onlyOwner {
        kycTiers[_user] = _tier;
    }

    function toggleKycEnforcement(bool _enforce) external onlyOwner {
        kycEnforced = _enforce;
    }

    function getMaxLeverage(address _user) public view returns (uint8) {
        if (!kycEnforced) return 10;
        uint8 tier = kycTiers[_user];
        if (tier == 3) return 10;
        if (tier == 2) return 5;
        if (tier == 1) return 2;
        return 0;
    }

    // --- LIQUIDITY POOL (For paying trader profits) ---
    function depositLiquidity(uint256 _amount) external {
        require(_amount > 0, "Amount must be > 0");
        require(usdtToken.transferFrom(msg.sender, address(this), _amount), "Deposit failed");
        emit LiquidityAdded(msg.sender, _amount);
    }

    function withdrawLiquidity(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Amount must be > 0");
        require(usdtToken.balanceOf(address(this)) >= _amount, "Insufficient liquidity");
        require(usdtToken.transfer(owner, _amount), "Withdraw failed");
        emit LiquidityWithdrawn(owner, _amount);
    }

    // --- USDT MARGIN TRADING ---
    function openLong(uint256 _collateralAmountUSDT, uint8 _leverage) external {
        require(_collateralAmountUSDT > 0, "Deposit USDT collateral");
        require(!positions[msg.sender].isOpen, "Position already open");

        uint8 maxAllowed = getMaxLeverage(msg.sender);
        require(_leverage <= maxAllowed && _leverage > 0, "Leverage exceeds tier limit");

        bool success = usdtToken.transferFrom(msg.sender, address(this), _collateralAmountUSDT);
        require(success, "USDT transfer failed");

        uint256 size = _collateralAmountUSDT * _leverage;
        positions[msg.sender] = Position({
            collateral: _collateralAmountUSDT,
            positionSize: size,
            entryPrice: markPrice,
            leverage: _leverage,
            isOpen: true
        });

        emit PositionOpened(msg.sender, _collateralAmountUSDT, _leverage, size);
    }

    function closePosition() external {
        Position storage pos = positions[msg.sender];
        require(pos.isOpen, "No active position");

        (bool liquidatable, int256 pnl) = checkPosition(msg.sender);
        require(!liquidatable, "Position is liquidatable");

        uint256 payout = 0;
        if (pnl >= 0) {
            payout = pos.collateral + uint256(pnl);
        } else {
            uint256 loss = uint256(-pnl);
            payout = loss >= pos.collateral ? 0 : pos.collateral - loss;
        }

        pos.isOpen = false;
        pos.collateral = 0;

        if (payout > 0) {
            uint256 contractBal = usdtToken.balanceOf(address(this));
            if (payout > contractBal) {
                payout = contractBal;
            }
            require(usdtToken.transfer(msg.sender, payout), "Transfer failed");
        }

        emit PositionClosed(msg.sender, pnl, payout);
    }

    function setPrice(uint256 _newPrice) external onlyOwner {
        markPrice = _newPrice;
        emit PriceUpdated(_newPrice);
    }

    function checkPosition(address _trader) public view returns (bool isLiquidatable, int256 pnl) {
        Position memory pos = positions[_trader];
        if (!pos.isOpen) return (false, 0);

        int256 priceDiff = int256(markPrice) - int256(pos.entryPrice);
        pnl = (int256(pos.positionSize) * priceDiff) / int256(pos.entryPrice);

        int256 maxLoss = -int256((pos.collateral * 90) / 100);
        isLiquidatable = (pnl <= maxLoss);
    }

    function liquidate(address _trader) external {
        Position storage pos = positions[_trader];
        require(pos.isOpen, "No active position");

        (bool liquidatable, ) = checkPosition(_trader);
        require(liquidatable, "Position safe");

        uint256 seized = pos.collateral;
        pos.isOpen = false;
        pos.collateral = 0;

        // 10% bounty to liquidator
        uint256 reward = (seized * 10) / 100;
        if (reward > 0) {
            require(usdtToken.transfer(msg.sender, reward), "Reward transfer failed");
        }

        emit PositionLiquidated(_trader, seized, msg.sender);
    }
}
