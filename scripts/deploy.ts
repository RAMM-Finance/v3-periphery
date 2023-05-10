import { Contract, ContractFactory, utils, BigNumber } from "ethers"
//const { ethers } = require("hardhat")
import { ethers } from "hardhat"
//const WETH9 = require("../WETH9.json")
import * as NFTDescriptor from "../artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json"
import * as NonfungibleTokenPositionDescriptor from "../artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"
import * as NonfungiblePositionManager from "../artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"
import * as QuoterV2 from "../artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json"
import { writeFile } from 'fs/promises'

const linkLibraries = ({ bytecode, linkReferences }: { bytecode: any, linkReferences: any }, libraries: any) => {
    Object.keys(linkReferences).forEach((fileName) => {
        Object.keys(linkReferences[fileName]).forEach((contractName) => {
            if (!libraries.hasOwnProperty(contractName)) {
                throw new Error(`Missing link library name ${contractName}`)
            }
            const address = utils
                .getAddress(libraries[contractName])
                .toLowerCase()
                .slice(2)
            linkReferences[fileName][contractName].forEach(
                ({ start, length }: { start: any, length: any }) => {
                    const start2 = 2 + start * 2
                    const length2 = length * 2
                    bytecode = bytecode
                        .slice(0, start2)
                        .concat(address)
                        .concat(bytecode.slice(start2 + length2, bytecode.length))
                }
            )
        })
    })
    return bytecode
}

async function main() {
    const [owner] = await ethers.getSigners();
    // console.log("Owner address:", owner.address)
    const weth = "0x4648a43B2C14Da09FdF82B161150d3F634f40491"
    let factory = "0x6e79176DE8C5838579BDACbD5784Fa1dd399A5Bb"

    let NFTDescriptor_F = new ContractFactory(NFTDescriptor.abi, NFTDescriptor.bytecode, owner);
    let nftDescriptor = await NFTDescriptor_F.deploy();
    await nftDescriptor.deployed();
    console.log('NFTDescriptor deployed to:', nftDescriptor.address)

    const linkedBytecode = linkLibraries(
        {
            bytecode: NonfungibleTokenPositionDescriptor.bytecode,
            linkReferences: NonfungibleTokenPositionDescriptor.linkReferences,
        },
        {
            NFTDescriptor: nftDescriptor.address,
        }
    );

    let NonfungibleTokenPositionDescriptor_F = new ContractFactory(NonfungibleTokenPositionDescriptor.abi, linkedBytecode, owner);
    let nonfungibleTokenPositionDescriptor = await NonfungibleTokenPositionDescriptor_F.deploy(weth, ethers.utils.formatBytes32String("MATIC"));

    let NonfungiblePositionManager_F = new ContractFactory(NonfungiblePositionManager.abi, NonfungiblePositionManager.bytecode, owner);
    let nonfungiblePositionManager = await NonfungiblePositionManager_F.deploy(factory, weth, nonfungibleTokenPositionDescriptor.address);

    let QuoterV2_F = new ContractFactory(QuoterV2.abi, QuoterV2.bytecode, owner);
    let quoterV2 = await QuoterV2_F.deploy(factory, weth);

    const addresses = {
        NFT_DESCRIPTOR_ADDRESS: nftDescriptor.address,
        POSITION_DESCRIPTOR_ADDRESS: nonfungibleTokenPositionDescriptor.address,
        POSITION_MANAGER_ADDRESS: nonfungiblePositionManager.address,
        QUOTER_V2_ADDRESS: quoterV2.address
    }

    await writeFile('addresses.json', JSON.stringify(addresses, null, 2));

    console.log('NFT_DESCRIPTOR_ADDRESS=', `'${nftDescriptor.address}'`)
    console.log('POSITION_DESCRIPTOR_ADDRESS=', `'${nonfungibleTokenPositionDescriptor.address}'`)
    console.log('POSITION_MANAGER_ADDRESS=', `'${nonfungiblePositionManager.address}'`)
    console.log('QUOTER_V2_ADDRESS=', `'${quoterV2.address}'`)
}

/*
npx hardhat run --network localhost scripts/01_deployContracts.js
*/

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });